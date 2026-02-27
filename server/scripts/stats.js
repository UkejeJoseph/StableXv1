import('../config/db.js').then(db => db.default()).then(async () => {
    const mongoose = await import('mongoose');
    const User = await import('../models/userModel.js').then(m => m.default);
    const Transaction = await import('../models/transactionModel.js').then(m => m.default);

    const userCount = await User.countDocuments();
    const txCount = await Transaction.countDocuments();

    const txStats = await Transaction.aggregate([
        { $group: { _id: "$type", count: { $sum: 1 }, totalVolume: { $sum: "$amount" } } }
    ]);

    const currencyStats = await Transaction.aggregate([
        { $group: { _id: "$currency", count: { $sum: 1 }, totalVolume: { $sum: "$amount" } } },
        { $sort: { count: -1 } }
    ]);

    console.log(JSON.stringify({ userCount, txCount, txStats, currencyStats }, null, 2));
    process.exit();
}).catch(e => { console.error(e); process.exit(1); });
