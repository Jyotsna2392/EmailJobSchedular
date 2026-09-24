import { esClient, EMAILS_INDEX, isElasticsearchAvailable } from '../config/elasticsearch';
import { prisma } from '../config/db';

export interface EmailSearchDoc {
  id: string;
  userId: string;
  senderAccountId?: string | null;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  etherealUrl?: string | null;
  scheduledAt: Date;
  sentAt?: Date | null;
  createdAt: Date;
}

export async function indexEmailInElasticsearch(email: EmailSearchDoc) {
  if (!isElasticsearchAvailable()) {
    return;
  }

  try {
    await esClient.index({
      index: EMAILS_INDEX,
      id: email.id,
      document: {
        id: email.id,
        userId: email.userId,
        senderAccountId: email.senderAccountId || null,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        etherealUrl: email.etherealUrl || null,
        scheduledAt: email.scheduledAt ? new Date(email.scheduledAt).toISOString() : null,
        sentAt: email.sentAt ? new Date(email.sentAt).toISOString() : null,
        createdAt: email.createdAt ? new Date(email.createdAt).toISOString() : null,
      },
      refresh: true, // Make searchable immediately
    });
  } catch (error) {
    console.error(`⚠️ Failed to index email ${email.id} in Elasticsearch:`, error);
  }
}

export async function searchEmails(params: {
  userId: string;
  query?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const from = (page - 1) * limit;

  // Try Elasticsearch search first if connected
  if (isElasticsearchAvailable()) {
    try {
      const mustClauses: any[] = [{ term: { userId: params.userId } }];

      if (params.status && params.status !== 'ALL') {
        mustClauses.push({ term: { status: params.status } });
      }

      if (params.query && params.query.trim().length > 0) {
        mustClauses.push({
          multi_match: {
            query: params.query.trim(),
            fields: ['subject^3', 'body^2', 'recipient^4'],
            fuzziness: 'AUTO',
          },
        });
      }

      const searchResult = await esClient.search({
        index: EMAILS_INDEX,
        from,
        size: limit,
        sort: [{ scheduledAt: { order: 'desc' } }],
        query: {
          bool: {
            must: mustClauses,
          },
        },
      });

      const totalHits = typeof searchResult.hits.total === 'number'
        ? searchResult.hits.total
        : searchResult.hits.total?.value || 0;

      const emails = searchResult.hits.hits.map((hit: any) => hit._source);

      return {
        source: 'elasticsearch',
        total: totalHits,
        page,
        limit,
        emails,
      };
    } catch (error) {
      console.warn('⚠️ Elasticsearch search error, falling back to database query:', error);
    }
  }

  // Database Fallback Search
  const where: any = { userId: params.userId };

  if (params.status && params.status !== 'ALL') {
    where.status = params.status;
  }

  if (params.query && params.query.trim().length > 0) {
    const q = params.query.trim();
    where.OR = [
      { subject: { contains: q } },
      { body: { contains: q } },
      { recipient: { contains: q } },
    ];
  }

  const [total, emails] = await Promise.all([
    prisma.emailJob.count({ where }),
    prisma.emailJob.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      skip: from,
      take: limit,
      include: { senderAccount: true },
    }),
  ]);

  return {
    source: 'database',
    total,
    page,
    limit,
    emails,
  };
}
