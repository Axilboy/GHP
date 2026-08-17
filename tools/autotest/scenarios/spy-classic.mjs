async function createReadyRoom(runner, suffix) {
  const players = ['Хост', 'Ирина', 'Макс', 'Лена'].map((name, index) => runner.player(`auto-${suffix}-${index + 1}`, name));
  await Promise.all(players.map((player) => player.connect()));
  const room = await players[0].createRoom();
  await Promise.all(players.slice(1).map((player) => player.joinRoom(room.code)));
  await players[0].act('update_settings', { settings: { roundSeconds: 300, targetScore: 3 } });
  await Promise.all(players.slice(1).map((player) => player.act('set_ready', { ready: true })));
  await players[0].act('start_round');
  const cards = await Promise.all(players.map((player) => player.revealRole()));
  await Promise.all(players.map((player) => player.act('role_seen')));
  await players[0].waitForRoom((nextRoom) => nextRoom.round?.phase === 'discussion');
  return { players, cards, roomId: room.id };
}

export const spyClassicScenario = {
  name: 'Шпион: многопользовательские игровые сценарии',
  async run(runner) {
    let firstGame;
    await runner.step('Четыре игрока создают комнату и получают разные роли', async (assert) => {
      firstGame = await createReadyRoom(runner, 'vote');
      assert.equal(firstGame.cards.filter((card) => card.isSpy).length, 1);
      const civilianLocations = new Set(firstGame.cards.filter((card) => !card.isSpy).map((card) => card.location));
      assert.equal(civilianLocations.size, 1);
      assert.equal(firstGame.cards.find((card) => card.isSpy).location, null);
    });

    await runner.step('Мирные находят шпиона общим голосованием', async (assert) => {
      const { players, cards } = firstGame;
      const spy = players[cards.findIndex((card) => card.isSpy)];
      await players[0].act('start_vote');
      const resultPromise = players[0].waitForRoom((room) => room.state === 'round_result');
      for (const player of players) {
        const target = player.id === spy.id ? players.find((candidate) => candidate.id !== spy.id) : spy;
        await player.act('vote', { targetId: target.id });
      }
      const result = await resultPromise;
      assert.equal(result.round.result.winner, 'civilians');
      assert.equal(result.round.result.reason, 'spy_found');
      assert.equal(result.scores.civilians, 1);
    });

    await runner.step('Хост возвращает всех игроков в лобби после раунда', async (assert) => {
      const rewarded = (await firstGame.players[0].request('get_profile')).profile;
      assert.equal(rewarded.stats.games, 1);
      assert.ok(rewarded.xp >= 40);
      await firstGame.players[0].act('next_round');
      const lobby = await firstGame.players[0].waitForRoom((room) => room.state === 'lobby');
      assert.equal(lobby.round, null);
      assert.equal(lobby.players.find((player) => player.id === lobby.hostId).ready, true);
    });

    let secondGame;
    await runner.step('Шпион может остановить игру, а мирные засчитывают ответ голосованием', async (assert) => {
      secondGame = await createReadyRoom(runner, 'guess');
      const spy = secondGame.players[secondGame.cards.findIndex((card) => card.isSpy)];
      await spy.act('spy_guess');
      const review = await spy.waitForRoom((room) => room.round?.phase === 'guess_review');
      assert.equal(review.round.amSpy, true);
      const resultPromise = spy.waitForRoom((room) => room.state === 'round_result');
      for (const player of secondGame.players.filter((player) => player.id !== spy.id)) await player.act('spy_guess_vote', { accepted: true });
      const result = await resultPromise;
      assert.equal(result.round.result.winner, 'spies');
      assert.equal(result.round.result.reason, 'spy_guess_accepted');
    });

    await runner.step('Сервер запрещает недоступные действия и сохраняет состояние', async (assert) => {
      const { players, cards } = await createReadyRoom(runner, 'errors');
      await assert.rejects(players[1].act('start_vote'), /Только хост/);
      await players[0].act('start_vote');
      await assert.rejects(players[1].act('vote', { targetId: players[1].id }), /Нельзя голосовать за себя/);
      const civilian = players[cards.findIndex((card) => !card.isSpy)];
      await assert.rejects(civilian.act('spy_guess'), /Действие недоступно/);
      assert.equal(players[0].room.round.phase, 'voting');
    });

    await runner.step('Игрок переподключается, а вышедший хост передаёт права', async (assert) => {
      const players = ['Хост', 'Оля', 'Дима'].map((name, index) => runner.player(`auto-room-${index + 1}`, name));
      await Promise.all(players.map((player) => player.connect()));
      const room = await players[0].createRoom();
      await players[1].joinRoom(room.code);
      await players[2].joinRoom(room.code);

      const offline = players[0].waitForRoom((nextRoom) => nextRoom.players.find((player) => player.id === players[2].id)?.online === false);
      players[2].disconnect();
      await offline;
      await players[2].connect();
      await players[2].request('resume_room', { roomId: room.id, playerId: players[2].id });
      assert.equal(players[2].room.players.find((player) => player.id === players[2].id).online, true);

      await players[0].act('leave_room');
      const transferred = await players[1].waitForRoom((nextRoom) => nextRoom.hostId === players[1].id);
      assert.equal(transferred.players.find((player) => player.id === players[1].id).ready, true);
    });

    await runner.step('Большинство игроков может досрочно запустить голосование', async (assert) => {
      const { players } = await createReadyRoom(runner, 'vote-request');
      await players[1].act('request_vote');
      await players[2].act('request_vote');
      const voting = await players[3].act('request_vote').then(() => players[0].waitForRoom((room) => room.round?.phase === 'voting'));
      assert.equal(voting.round.phase, 'voting');
    });

    await runner.step('PRO-хост запускает режим с двумя шпионами', async (assert) => {
      const players = ['Хост', 'Один', 'Два', 'Три'].map((name, index) => runner.player(`auto-duo-${index + 1}`, name));
      await Promise.all(players.map((player) => player.connect()));
      await players[0].request('activate_demo_plan', { plan: 'pro', months: 1 });
      const room = await players[0].createRoom();
      await Promise.all(players.slice(1).map((player) => player.joinRoom(room.code)));
      await players[0].act('update_settings', { settings: { spyCount: 2 } });
      await Promise.all(players.slice(1).map((player) => player.act('set_ready', { ready: true })));
      await players[0].act('start_round');
      const cards = await Promise.all(players.map((player) => player.revealRole()));
      assert.equal(cards.filter((card) => card.isSpy).length, 2);
    });
  },
};
