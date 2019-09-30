const neo4j = require('neo4j-driver').v1;
const driver = new neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("neo4j", "leon"));
const thorify = require("thorify").thorify;
const Web3 = require("web3");
const web3 = thorify(new Web3(), "http://localhost:8669");

const DeleteAll = async (session) => {
    let query = `MATCH (n) DETACH DELETE n`
    return await session.run(query)
}
const createBlock = async (session, block) => {
    
    let query = `CREATE (n:Block {number : '${block.number}'})`
    return await session.run(query)
}

const createTx = async (session, tx) => {
    let query = `CREATE (n:Tx {id : '${tx.id}'})`
    return await session.run(query)
}
const createtxRelation = async (session, tx, block) => {
    let createRelationQuery = `MATCH (a:Tx),(b:Block)
    WHERE a.id = '${tx.id}' AND b.number = '${block.number}'
    CREATE (a)-[r:tx]->(b)
    RETURN type(r)`
    return await session.run(createRelationQuery)
}


const main = async () => {
    const session = driver.session()
    //await DeleteAll(session)
    var Block = await web3.eth.getBlock("latest");
    try {
        await createBlock(session, Block)
    } catch (error) {
        console.log(error)
    }
    for (let tx of Block.transactions) {
        let txData = await web3.eth.getTransaction(tx);
        console.log(txData)
        try {
            //console.log (Block)
            await createTx(session, txData)
            await createtxRelation(session, txData , Block)
        } catch (error) {
            console.log(error)
        }


    }

    await session.close()
    await driver.close()
}

main()