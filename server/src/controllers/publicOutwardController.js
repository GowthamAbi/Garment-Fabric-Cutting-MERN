import {
  getInwardForQR,
  issueFromExactInward,
} from "../services/publicOutwardService.js";

export async function getPublicInward(request, response) {
  response.json(await getInwardForQR(request.params.inwardNo));
}

export async function createPublicOutward(request, response) {
  response.status(201).json(await issueFromExactInward(request.body));
}
