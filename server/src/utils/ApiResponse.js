export const successResponse = (data, message = "Success") => ({
  success: true,
  message,
  data,
});
