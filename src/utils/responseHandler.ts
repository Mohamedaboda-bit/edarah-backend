import { Response } from 'express';

export const success = (res: Response, data: any) => {
  res.status(200).json({ success: true, data });
};

export const error = (res: Response, message: any, code = 500) => {
  res.status(code).json({ success: false, error: message });
};
