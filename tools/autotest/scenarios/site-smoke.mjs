export const siteSmokeScenario = {
  name: 'Сайт и публичные страницы',
  async run(runner) {
    await runner.step('Сервер отвечает и основные страницы открываются', async (assert) => {
      for (const route of ['/api/health', '/', '/games/spy', '/games/alias', '/profile', '/store', '/demo', '/vk', '/privacy', '/terms']) {
        const response = await fetch(`${runner.baseUrl}${route}`);
        assert.equal(response.status, 200, `${route} returned ${response.status}`);
      }
    });

    await runner.step('VK Mini Apps launch endpoint доступен для проверки параметров', async (assert) => {
      const response = await fetch(`${runner.baseUrl}/api/vk/launch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ params: { vk_app_id: '1', vk_user_id: '42', vk_platform: 'mobile_web' } }),
      });
      assert.equal(response.status, 200);
      const launch = await response.json();
      assert.equal(launch.ok, true);
      assert.equal(launch.vk.userId, '42');
    });

    await runner.step('Alias подготовлен в общем каталоге игр', async (assert) => {
      const catalog = await fetch(`${runner.baseUrl}/api/games/alias/catalog`).then((response) => response.json());
      assert.equal(catalog.definition.id, 'alias');
      assert.equal(catalog.definition.status, 'mvp');
      assert.ok(catalog.dictionaries.length >= 3);
    });

    await runner.step('Каталог Шпиона содержит игровое определение и словарь', async (assert) => {
      const catalog = await fetch(`${runner.baseUrl}/api/games/spy/catalog`).then((response) => response.json());
      assert.equal(catalog.definition.id, 'spy');
      assert.equal(catalog.definition.name, 'Шпион');
      assert.ok(catalog.dictionaries[0].locationCount >= 30);
    });

    await runner.step('Локации доступны для игрового интерфейса', async (assert) => {
      const data = await fetch(`${runner.baseUrl}/api/games/spy/locations`).then((response) => response.json());
      assert.ok(data.locations.length >= 30);
      assert.ok(data.locations.every((location) => location.id && location.name));
    });
  },
};
