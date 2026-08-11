-- 튜토리얼 기능을 만들지 않기로 확정되어 컬럼을 제거한다.
-- 값은 전부 기본값 0 이며 참조하는 코드가 없다.
ALTER TABLE "users" DROP COLUMN "tutorial_step";
