import { Request, Response } from 'express';
import { searchEmails } from '../services/search.service';

export async function searchEmailsController(req: Request, res: Response) {
  try {
    const { userId, q, status, page = 1, limit = 20 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const result = await searchEmails({
      userId: userId as string,
      query: (q as string) || '',
      status: (status as string) || 'ALL',
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Search controller error:', error);
    return res.status(500).json({ error: error.message || 'Failed to search emails' });
  }
}
