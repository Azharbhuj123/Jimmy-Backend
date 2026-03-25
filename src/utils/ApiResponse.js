class ApiResponse {
  static success(res, data = {}, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({ success: true, message, data });
  }
  static paginated(res, data, pagination, message = 'Success') {
    return res.status(200).json({ success: true, message, data, pagination });
  }
  static error(res, message = 'Error', statusCode = 500, errors = []) {
    return res.status(statusCode).json({ success: false, message, errors });
  }
}
module.exports = ApiResponse;