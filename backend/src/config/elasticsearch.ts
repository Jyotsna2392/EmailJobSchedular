import { Client } from '@elastic/elasticsearch';
import { config } from './env';

export const esClient = new Client({
  node: config.elasticsearch.node,
  requestTimeout: 3000,
});

export const EMAILS_INDEX = 'reachinbox_emails';
let esAvailable = false;

export function isElasticsearchAvailable(): boolean {
  return esAvailable;
}

export async function initElasticsearch(): Promise<boolean> {
  try {
    const ping = await esClient.ping();
    if (ping) {
      esAvailable = true;
      console.log('✅ Elasticsearch connected successfully');
      
      const indexExists = await esClient.indices.exists({ index: EMAILS_INDEX });
      if (!indexExists) {
        await esClient.indices.create({
          index: EMAILS_INDEX,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              senderAccountId: { type: 'keyword' },
              recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              etherealUrl: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              createdAt: { type: 'date' },
            },
          },
        });
        console.log(`✅ Elasticsearch index '${EMAILS_INDEX}' created.`);
      }
      return true;
    }
  } catch (error) {
    esAvailable = false;
    console.warn('⚠️ Elasticsearch is offline or unreachable. Search fallback mode to DB active.');
  }
  return false;
}
