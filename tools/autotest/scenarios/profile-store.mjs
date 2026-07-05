export const profileStoreScenario = {
  name: 'Profile, store and PRO',
  async run(runner) {
    const buyer = runner.player('auto-shop-buyer', 'Buyer');
    await buyer.connect();

    async function signInBuyer(assert) {
      const email = 'autotest-buyer@example.com';
      const codeResponse = await fetch(`${runner.baseUrl}/api/auth/request-code`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      assert.equal(codeResponse.status, 200);
      const verifyResponse = await fetch(`${runner.baseUrl}/api/auth/verify-code`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, code: '111111', playerId: buyer.id, name: buyer.name }),
      });
      const verifyData = await verifyResponse.json();
      assert.equal(verifyData.ok, true);
      assert.equal(verifyData.profile.accountType, 'email');
      buyer.socket.emit('identify', { playerId: verifyData.account.id });
    }

    await runner.step('Guest profile starts with progress and base dictionary', async (assert) => {
      const { profile } = await buyer.request('get_profile');
      assert.equal(profile.accountType, 'guest');
      assert.equal('coins' in profile, false);
      assert.deepEqual(profile.ownedDictionaryIds, ['base']);
      assert.deepEqual(profile.orders, []);
      assert.deepEqual(profile.purchases, []);
    });

    await runner.step('Guest must sign in before purchase', async (assert) => {
      await assert.rejects(
        buyer.request('create_order', { type: 'dictionary', productId: 'city' }),
        /Войдите или зарегистрируйтесь/,
      );
      await signInBuyer(assert);
      const { profile } = await buyer.request('get_profile');
      assert.equal(profile.accountType, 'email');
      assert.equal(profile.email, 'autotest-buyer@example.com');
    });

    await runner.step('Signed-in player creates and confirms a dictionary order', async (assert) => {
      const { order } = await buyer.request('create_order', { type: 'dictionary', productId: 'city' });
      assert.equal(order.status, 'pending');
      const { profile } = await buyer.request('confirm_demo_order', { orderId: order.id });
      assert.ok(profile.ownedDictionaryIds.includes('city'));
      assert.equal(profile.purchases[0].productId, 'city');
    });

    await runner.step('PRO order activates without real payment in demo mode', async (assert) => {
      const { order } = await buyer.request('create_order', { type: 'subscription', productId: 'pro', months: 1 });
      const { profile } = await buyer.request('confirm_demo_order', { orderId: order.id });
      assert.equal(profile.pro, true);
    });

    await runner.step('PRO+ is not sold in the MVP storefront', async (assert) => {
      await assert.rejects(
        buyer.request('create_order', { type: 'subscription', productId: 'pro_plus', months: 3 }),
        /Товар не найден/,
      );
    });

    await runner.step('Player creates a custom location', async (assert) => {
      const { order } = await buyer.request('create_order', { type: 'custom_dictionary', productId: 'custom_dictionary' });
      await buyer.request('confirm_demo_order', { orderId: order.id });
      const { profile } = await buyer.request('add_custom_location', { location: { name: 'Home', roles: ['Host', 'Guest', 'Neighbor'] } });
      assert.ok(profile.customLocations.some((location) => location.name === 'Home'));
    });

    await runner.step('Party pass activates a temporary entitlement', async (assert) => {
      const { order } = await buyer.request('create_order', { type: 'party_pass', productId: 'party_pass_24h' });
      const { profile } = await buyer.request('confirm_demo_order', { orderId: order.id });
      assert.ok(profile.partyPasses[0].activeUntil > Date.now());
    });

    await runner.step('Bundle unlocks several dictionaries in one purchase', async (assert) => {
      const { order } = await buyer.request('create_order', { type: 'bundle', productId: 'starter' });
      const { profile } = await buyer.request('confirm_demo_order', { orderId: order.id });
      assert.ok(profile.ownedDictionaryIds.includes('city'));
      assert.ok(profile.ownedDictionaryIds.includes('travel'));
    });
  },
};
