import Transaction from "../models/Transaction.js";

export const transactionRepository = {
  findAll: (filter = {}) =>
    Transaction.find(filter).sort({ transactionDate: -1 }),

  create: async (transactionData, session = null) => {
    const transactions = await Transaction.create([transactionData], {
      session,
    });
    return transactions[0];
  },
};
