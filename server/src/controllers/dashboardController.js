import { getDashboardSummary } from "../services/dashboardService.js";

export async function getDashboard(_request, response) {
  response.json(await getDashboardSummary());
}
