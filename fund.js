(async () => {
    try {
        const res1 = await fetch('http://localhost:5000/api/admin/fund-demo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'jukeje07@gmail.com', currency: 'USDT', amount: 5000 })
        });
        console.log('USDT funding:', await res1.json());

        const res2 = await fetch('http://localhost:5000/api/admin/fund-demo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'jukeje07@gmail.com', currency: 'NGN', amount: 5000000 })
        });
        console.log('NGN funding:', await res2.json());
    } catch (e) {
        console.error('Funding failed:', e);
    }
})();
