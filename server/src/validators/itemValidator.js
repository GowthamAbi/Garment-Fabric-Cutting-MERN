import ApiError from "../utils/ApiError.js";

export function validateItem(request, _response, next) {
  const { itemCode, description, category } = request.body;

  if (!itemCode || !description || !category) {
    return next(
      new ApiError(400, "Item code, description and category are required"),
    );
  }

  next();
}
