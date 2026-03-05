const anomalyData = {
	id: "anom-1",
	billingAccount: "ba-123",
	attribution: "Project X",
	costOfAnomaly: 150.5,
	platform: "gcp",
	scope: "project",
	serviceName: "Compute Engine",
	top3SKUs: [
		{ name: "SKU A", cost: 50.25 },
		{ name: "SKU B", cost: 60.15 },
		{ name: "SKU C", cost: 40.1 },
	],
	severityLevel: "high",
	timeFrame: "daily",
	startTime: 1705276800000, // 2024-01-15T00:00:00Z
	status: "open",
	endTime: 1705363200000, // 2024-01-16T00:00:00Z
	acknowledged: false,
};

export const anomaliesFixture = {
	rowCount: 1,
	anomalies: [anomalyData],
	pageToken: "",
};

export const anomalyFixture = { ...anomalyData };
