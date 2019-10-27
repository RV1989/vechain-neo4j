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

const updateAccountInfo = async (session, accountId) => {
    let account = await web3.eth.accounts(accountId)
    let updateQuery = `MERGE (b:Account{id:'${accountId}' , hasCode : ${account.hasCode}})`
    return await session.run(updateQuery)

}
const createAccountOriginRelation = async (session, tx) => {
    let createRelationQuery = `MERGE (a:Tx{id:'${tx.id}'})
    MERGE (b:Account{id:'${tx.origin}'})
    CREATE (b)-[r:AccountTx]->(a)
    RETURN type(r)`
    return await session.run(createRelationQuery)
}

const createAccountDelegatorRelation = async (session, tx) => {
    let createRelationQuery = `MERGE (a:Tx{id:'${tx.id}'})
    MERGE (b:Account{id:'${tx.delegator}'})
    CREATE (b)-[r:txDelegator]->(a)
    RETURN type(r)`
    return await session.run(createRelationQuery)
}

const createClauseAccountRelation = async (session, tx,clauseNumber) => {
    let createRelationQuery = `MERGE (a:Clause{id:'${tx.id}Cl${clauseNumber}'})
    MERGE (b:Account{id:'${tx.clauses[clauseNumber].to}'})
    CREATE (a)-[r:clauseAccount]->(b)
    RETURN type(r)`
    //updateAccountInfo(session,tx.clauses[clauseNumber].to)
    return await session.run(createRelationQuery)
}
const createTx = async (session, tx) => {
    let query = `CREATE (n:Tx {id : '${tx.id}'})`
    return await session.run(query)
}

const createTxRelation = async (session, tx) => {
    let createRelationQuery = `MATCH (a:Tx),(b:Block)
    WHERE a.id = '${tx.id}' AND b.number = ${tx.blockNumber}
    CREATE (a)-[r:txBlock]->(b)
    RETURN type(r)`
    return await session.run(createRelationQuery)
}

const createClause = async (session, tx,clauseNumber) => {
    let query = `CREATE (n:Clause {id : '${tx.id}Cl${clauseNumber}'})`
    return await session.run(query)
}

const createClauseTxRelation = async (session, tx,clauseNumber) => {
    let createRelationQuery = `MATCH (a:Clause),(b:Tx)
    WHERE a.id = '${tx.id}Cl${clauseNumber}' AND b.id = '${tx.id}'
    CREATE (b)-[r:txClause]->(a)
    RETURN type(r)`
    return await session.run(createRelationQuery)
}



const txHandler = async (session,block) => {
    return await Promise.all(block.transactions.map( async (txId)=> {
        let tx = await web3.eth.getTransaction(txId)
        await createTx(session ,tx) 
        await createTxRelation(session, tx)
        await createAccountOriginRelation(session,tx)
        if (tx.delegator){
            await createAccountDelegatorRelation(session,tx)
        }
        
        for (let [i,clauses] of tx.clauses.entries()){
            await createClause(session,tx,i)
            await createClauseTxRelation(session,tx,i)
            await createClauseAccountRelation(session,tx,i)

        }

        return Promise.resolve()
        

            
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
    let lastBlock = await web3.eth.getBlock('latest')
    let firstBlock = await web3.eth.getBlock(lastBlock.number - 100)
    
    let blockNumber = _.range(firstBlock.number , lastBlock.number )

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