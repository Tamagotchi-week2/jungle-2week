/**
 * DB 구조 점검 스크립트.
 *
 *   npm run db:inspect
 *
 * 실제 DB 에 반영된 구조를 그대로 읽어 보여준다. schema.prisma 는 "의도"이고
 * 이건 "현실"이다. 마이그레이션이 밀렸거나 누군가 손으로 고쳤으면 여기서 갈린다.
 *
 * 읽기 전용이다. 어떤 것도 바꾸지 않는다.
 */

import { PrismaClient } from '../src/generated/prisma';

const db = new PrismaClient();

interface Column {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface Constraint {
  table_name: string;
  constraint_name: string;
  constraint_type: string;
  columns: string;
}

interface Fk {
  table_name: string;
  columns: string;
  foreign_table: string;
  foreign_columns: string;
}

function schemaOf(url: string | undefined): string {
  if (!url) return 'public';
  const m = url.match(/[?&]schema=([^&]+)/);
  return m ? m[1] : 'public';
}

async function main() {
  const schema = schemaOf(process.env.DATABASE_URL);
  console.log(`\n스키마: ${schema}\n${'='.repeat(70)}`);

  const columns = await db.$queryRawUnsafe<Column[]>(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = $1
     ORDER BY table_name, ordinal_position`,
    schema,
  );

  const constraints = await db.$queryRawUnsafe<Constraint[]>(
    `SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
            string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     WHERE tc.table_schema = $1 AND tc.constraint_type IN ('PRIMARY KEY','UNIQUE')
     GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
     ORDER BY tc.table_name`,
    schema,
  );

  const fks = await db.$queryRawUnsafe<Fk[]>(
    `SELECT tc.table_name,
            string_agg(DISTINCT kcu.column_name, ', ') AS columns,
            ccu.table_name AS foreign_table,
            string_agg(DISTINCT ccu.column_name, ', ') AS foreign_columns
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
     WHERE tc.table_schema = $1 AND tc.constraint_type = 'FOREIGN KEY'
     GROUP BY tc.table_name, tc.constraint_name, ccu.table_name
     ORDER BY tc.table_name`,
    schema,
  );

  const tables = [...new Set(columns.map((c) => c.table_name))].filter(
    (t) => t !== '_prisma_migrations',
  );

  for (const table of tables) {
    const rows = await db.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "${schema}"."${table}"`,
    );
    console.log(`\n■ ${table}   (${rows[0].n} rows)`);

    for (const c of columns.filter((x) => x.table_name === table)) {
      const nullable = c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const def = c.column_default ? ` = ${c.column_default.slice(0, 28)}` : '';
      console.log(
        `    ${c.column_name.padEnd(26)} ${c.data_type.padEnd(26)} ${nullable}${def}`,
      );
    }

    const keys = constraints.filter((x) => x.table_name === table);
    for (const k of keys) {
      console.log(`    · ${k.constraint_type.padEnd(12)} (${k.columns})`);
    }

    for (const f of fks.filter((x) => x.table_name === table)) {
      console.log(`    · FK           (${f.columns}) → ${f.foreign_table}(${f.foreign_columns})`);
    }
  }

  const applied = await db.$queryRawUnsafe<{ migration_name: string }[]>(
    `SELECT migration_name FROM "${schema}"."_prisma_migrations"
     WHERE finished_at IS NOT NULL ORDER BY finished_at`,
  );
  console.log(`\n${'='.repeat(70)}`);
  console.log('적용된 마이그레이션:');
  for (const m of applied) console.log(`    ${m.migration_name}`);
  console.log(`\n테이블 ${tables.length}개\n`);
}

main()
  .catch((e) => {
    console.error('점검 실패:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
