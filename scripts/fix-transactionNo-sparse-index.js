/**
 * Ensure transactionNo index is unique+sparse (allows multiple nulls)
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected');

    const db = mongoose.connection.db;
    const col = db.collection('transactions');

    const indexes = await col.indexes();
    const txIdx = indexes.find(i => i.key && i.key.transactionNo === 1);
    if (txIdx) {
      console.log(`Dropping existing index: ${txIdx.name}`);
      await col.dropIndex(txIdx.name);
    }

    console.log('Creating unique+sparse index on transactionNo...');
    await col.createIndex({ transactionNo: 1 }, { unique: true, sparse: true, name: 'transactionNo_1' });
    console.log('✓ Index created');

    const verify = await col.indexes();
    console.log('Indexes now:');
    verify.forEach(i => console.log(` - ${i.name}:`, i.key, i.unique ? '(unique)' : '', i.sparse ? '(sparse)' : ''));

    await mongoose.connection.close();
    console.log('✓ Closed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed:', err);
    try { await mongoose.connection.close(); } catch(_){}
    process.exit(1);
  }
}

run();
