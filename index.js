const neo4j = require('neo4j-driver').v1;
const driver = new neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("neo4j", "leon"));
const thorify = require("thorify").thorify;
const Web3 = require("web3");
const web3 = thorify(new Web3(), "http://localhost:8669");
const _ = require('lodash')

const DeleteAll = async (session) => {
    let query = `MATCH (n) DETACH DELETE n`
    return await session.run(query)
}
const createBlock = async (session, block) => {
    
    let query = `CREATE (n:Block {number : ${block.number}})`
    return await session.run(query)
}

const createBlockRelation = async (session, block) => {
    let createRelationQuery = `MATCH (a:Block),(b:Block)
    WHERE a.number = ${block.number -1 } AND b.number = ${block.number}
    CREATE (a)-[r:blockBlock]->(b)
    RETURN type(r)`
    return await session.run(createRelationQuery)
}

const createTx = async (session, tx) => {
    let query = `CREATE (n:Tx {id : '${tx.id}'})`
    return await session.run(query)
}

const createTxRelation = async (session, tx) => {
    let createRelationQuery = `MATCH (a:Tx),(b:Block)
    WHERE a.id = '${tx.id}' AND b.number = ${tx.meta.blockNumber}
    CREATE (a)-[r:txBlock]->(b)
    RETURN type(r)`
    return await session.run(createRelationQuery)
}

const txHandler = async (session,block) => {
    return await Promise.all(block.transactions.map( async (txId)=> {
        let tx = await web3.eth.getTransaction(txId)
        return await Promise.all([tx,
            createTx(session ,tx) , 
            createTxRelation(session, tx)])
    }))
}

const blockHandler = async (session, blockNumber) =>{
    let block = await web3.eth.getBlock(blockNumber); 
    let createBlockRes = await createBlock(session, block)
    let createBlockRelationRes = await createBlockRelation(session ,block)  
    let txHandlerRes = await txHandler(session, block) 
    return await Promise.all( [block , createBlockRes , createBlockRelationRes ,  txHandlerRes       
   ]
   )
}

const main = async () => {
    const session = driver.session()
    await DeleteAll(session)
    let firstBlock = 0
    let lastBlock = 1000
    let blockNumber = _.range(firstBlock , lastBlock +1 )

    for (let blockNr of blockNumber){
        let result =  await blockHandler(session , blockNr)

    }
    /* await Promise.all( blockNumber.map( async (blockNr) => {
        return 
    }))*/

    


    await session.close()
    await driver.close()
    return Promise.resolve()
}

main()