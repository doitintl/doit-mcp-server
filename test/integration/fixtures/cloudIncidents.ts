export const cloudIncidentsFixture = {
	pageToken: "",
	rowCount: 2,
	incidents: [
		{
			id: "inc-1",
			createTime: 1700000000000,
			platform: "google-cloud",
			product: "Compute Engine",
			title: "Elevated error rates",
			status: "active",
			summary: "Some VMs experiencing issues",
			description: "Detailed description of the incident",
		},
		{
			id: "inc-2",
			createTime: 1700001000000,
			platform: "amazon-web-services",
			product: "EC2",
			title: "Network latency",
			status: "resolved",
		},
	],
};

export const cloudIncidentFixture = {
	id: "inc-1",
	createTime: 1700000000000,
	platform: "google-cloud",
	product: "Compute Engine",
	title: "Elevated error rates",
	status: "active",
	summary: "Some VMs experiencing issues",
	description: "Detailed description of the incident",
	symptoms: "Increased latency",
	workaround: "Retry requests",
};
