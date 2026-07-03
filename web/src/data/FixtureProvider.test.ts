// ADR-0013 (G-2): setMainCharacterOverride のランタイム上書きを検証する。
// data/imported/ に依存する ImportedProvider は import.meta.glob がテスト環境で空になるため、
// 同じロジックを持つ FixtureProvider（data/fixtures/*.json）で代替検証する。
import { describe, it, expect, beforeEach } from "vitest";
import { FixtureProvider } from "./FixtureProvider";

const ZSS_ID = "11111111-1111-4111-8111-111111111111";
const MARIO_ID = "22222222-2222-4222-8222-222222222222";

describe("FixtureProvider.setMainCharacterOverride", () => {
  let provider: FixtureProvider;

  beforeEach(() => {
    provider = new FixtureProvider();
  });

  it("初期状態はJSON由来のis_main（ZSS）を返す", async () => {
    const main = await provider.getMainCharacter();
    expect(main?.character.id).toBe(ZSS_ID);
  });

  it("切替後は新しいキャラのみis_main=trueになる（単一制約）", async () => {
    provider.setMainCharacterOverride(MARIO_ID);
    const main = await provider.getMainCharacter();
    expect(main?.character.id).toBe(MARIO_ID);

    const list = await provider.listCharacters();
    const mainFlags = list.filter((c) => c.is_main);
    expect(mainFlags).toHaveLength(1);
    expect(mainFlags[0]?.id).toBe(MARIO_ID);
  });

  it("切替後に元のキャラへ戻すと再びis_main=trueになる（非破壊）", async () => {
    provider.setMainCharacterOverride(MARIO_ID);
    provider.setMainCharacterOverride(ZSS_ID);
    const main = await provider.getMainCharacter();
    expect(main?.character.id).toBe(ZSS_ID);
  });

  it("getCharacterBySlug の is_main も上書きが反映される", async () => {
    provider.setMainCharacterOverride(MARIO_ID);
    const mario = await provider.getCharacterBySlug("mario");
    const zss = await provider.getCharacterBySlug("zss");
    expect(mario?.character.is_main).toBe(true);
    expect(zss?.character.is_main).toBe(false);
  });
});
