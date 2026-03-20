
const RagService = require('./domain/services/ragService');

async function testRAG() {
    console.log("--- Testing searchContext for SERUMS ---");
    const context = await RagService.searchContext("medicina", 3, { target: 'SERUMS' });
    console.log("Context retrieved:");
    console.log(context);

    console.log("\n--- Testing getStyleExamples for SERUMS-medicina ---");
    const style = await RagService.getStyleExamples('%SERUMS-medicina%', 3);
    console.log("Style examples retrieved:");
    console.log(style);
}

testRAG().catch(console.error);
