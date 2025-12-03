import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";

dotenv.config({ path: '../.env' });

async function inspectQdrant() {
    const url = process.env.QDRANT_URL || "http://localhost:6333";
    const collection = process.env.QDRANT_COLLECTION || "email_policies";

    console.log(`Connecting to Qdrant at ${url}, Collection: ${collection}`);

    const client = new QdrantClient({ url });

    try {
        const response = await client.scroll(collection, {
            limit: 10,
            with_payload: true,
            with_vector: false
        });

        console.log(`Found ${response.points.length} points (showing max 10):`);
        response.points.forEach((point, index) => {
            console.log(`\n--- Point ${index + 1} [ID: ${point.id}] ---`);
            console.log(JSON.stringify(point.payload, null, 2));
        });

    } catch (error) {
        console.error("Error fetching data from Qdrant:", error.message);
    }
}

inspectQdrant();
