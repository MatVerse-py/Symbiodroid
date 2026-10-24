/** Structural adapter for the existing expo-sqlite dependency. Android integration: HOLD. */
import type { SqlPort, SqlTx, SqlValue } from './durable-journal';
export interface ExpoSqlTransaction {
  runAsync(sql:string,...args:SqlValue[]):Promise<{changes:number}>;
  getFirstAsync<T extends object>(sql:string,...args:SqlValue[]):Promise<T|null>;
}
export interface ExpoSqlDatabase {
  execAsync(sql:string):Promise<void>;
  withExclusiveTransactionAsync<T>(task:(tx:ExpoSqlTransaction)=>Promise<T>):Promise<T>;
}
export function expoSqlitePort(db:ExpoSqlDatabase):SqlPort {
  return {
    execute(sql){return db.execAsync(sql)},
    transaction(task){
      return db.withExclusiveTransactionAsync(tx=>{
        const adapter:SqlTx={
          async run(sql,...args){const r=await tx.runAsync(sql,...args);return {changes:r.changes}},
          get(sql,...args){return tx.getFirstAsync(sql,...args)}
        };
        return task(adapter);
      });
    }
  };
}
