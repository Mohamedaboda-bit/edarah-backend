"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.error = exports.success = void 0;
const success = (res, data) => {
    res.status(200).json({ success: true, data });
};
exports.success = success;
const error = (res, message, code = 500) => {
    res.status(code).json({ success: false, error: message });
};
exports.error = error;
//# sourceMappingURL=responseHandler.js.map