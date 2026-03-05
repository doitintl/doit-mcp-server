// Timestamps in ms: 2024-01-01 and 2024-02-01
const invDate = new Date("2024-01-01").getTime();
const dueDate = new Date("2024-02-01").getTime();

export const invoicesFixture = {
	invoices: [
		{
			id: "inv-1",
			invoiceDate: invDate,
			platform: "gcp",
			dueDate,
			status: "paid",
			totalAmount: 5000.0,
			balanceAmount: 0,
			currency: "USD",
			url: "https://console.doit.com/invoices/inv-1",
		},
	],
	rowCount: 1,
};

export const invoiceFixture = {
	id: "inv-1",
	invoiceDate: invDate,
	platform: "gcp",
	dueDate,
	status: "paid",
	totalAmount: 5000.0,
	balanceAmount: 0,
	currency: "USD",
	url: "https://console.doit.com/invoices/inv-1",
};

export const assetsFixture = {
	assets: [
		{
			id: "asset-1",
			name: "My Billing Account",
			type: "commitment",
			quantity: 1,
			url: "https://console.doit.com/assets/asset-1",
			createTime: 1700000000,
		},
	],
	pageToken: "",
	rowCount: 1,
};
