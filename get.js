const platformClient = require("purecloud-platform-client-v2");
const { Client } = require('pg');
const config = require('./config');

const client = platformClient.ApiClient.instance;
client.setEnvironment(platformClient.PureCloudRegionHosts.ap_south_1);
client.setAccessToken(process.env.GENESYS_CLOUD_ACCESS_TOKEN); 

const apiInstance = new platformClient.ConversationsApi();
const conversationId = "98e79a93-2435-454b-ad51-2dc9fdd4361c";

async function storeConversationDetails(conversationDetails) {
  const dbConfig = config.database;
  const dbClient = new Client(dbConfig);

  try {
    await dbClient.connect();

    const {
      id: conversationId,
      start_date: startDate,
      end_date: endDate,
      duration : duration,
      ani : ani,
      dnsis : dnis,
      direction : direction,
      division_id: divisionId,
    } = conversationDetails;

    const query = `
      INSERT INTO conversations (conversation_id, start_date, end_date, duration, ani, dnis, direction, division_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    const values = [conversationId, startDate, endDate, duration, ani, dnis, direction, divisionId];

    await dbClient.query(query, values);
  } catch (err) {
    console.error("Error storing conversation details:", err);
  } finally {
    await dbClient.end();
  }
}

apiInstance.getAnalyticsConversationDetails(conversationId)
  .then(data => {
    console.log(`getAnalyticsConversationDetails success! data: ${JSON.stringify(data, null, 2)}`);
    storeConversationDetails(data);
  })
  .catch(err => {
    console.error("Error calling getAnalyticsConversationDetails:", err);
  });
