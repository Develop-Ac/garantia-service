import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { OpenQueryService } from '../shared/database/openquery/openquery.service';

@Injectable()
export class ErpService {
  private readonly logger = new Logger(ErpService.name);

  constructor(private readonly openQuery: OpenQueryService) {}

  async query<T = any>(sqlQuery: string, params: (string | number | null)[] = []): Promise<T[]> {
    try {
      const firebirdSql = this.injectParams(sqlQuery, params);
      const tsql = this.wrapOpenQuery(firebirdSql);
      return await this.openQuery.query<T>(tsql, {}, { timeout: 120_000, allowZeroRows: true });
    } catch (error: any) {
      this.logger.error(`Falha na consulta OPENQUERY: ${error?.message || error}`);
      throw new InternalServerErrorException('Erro ao consultar o ERP via OPENQUERY.');
    }
  }

  private injectParams(sqlQuery: string, params: (string | number | null)[]): string {
    if (!params?.length) {
      return sqlQuery;
    }

    let index = 0;
    const result = sqlQuery.replace(/\?/g, () => {
      if (index >= params.length) {
        throw new Error('Numero de parametros insuficiente para a query.');
      }
      const value = params[index++];
      return this.formatParam(value);
    });

    if (index < params.length) {
      this.logger.warn(`Sobrou parametro nao utilizado na query: ${params.slice(index).join(', ')}`);
    }

    return result;
  }

  private formatParam(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value.toString() : 'NULL';
    }

    const trimmed = `${value}`;
    const escaped = trimmed.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  private wrapOpenQuery(innerSql: string): string {
    const cleaned = innerSql.trim().replace(/;$/, '');
    const escaped = cleaned.replace(/'/g, "''");
    return `SELECT * FROM OPENQUERY(CONSULTA, '${escaped}')`;
  }
}
