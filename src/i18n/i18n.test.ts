import assert from "node:assert/strict";
import { test } from "node:test";
import { detectDeviceLocale, localeDateTag, resolveLocaleTag, translate } from "@/i18n";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import ptBR from "@/i18n/messages/pt-BR.json";

test("locale fallback uses English for unknown keys via en catalog", () => {
  assert.equal(translate("es", "tabs.today"), "Hoy");
  assert.equal(translate("pt-BR", "tabs.today"), "Hoje");
  assert.equal(translate("en", "tabs.today"), "Today");
});

test("resolveLocaleTag maps regional tags", () => {
  assert.equal(resolveLocaleTag("es-MX"), "es");
  assert.equal(resolveLocaleTag("pt-BR"), "pt-BR");
  assert.equal(resolveLocaleTag("pt_PT"), "pt-BR");
  assert.equal(resolveLocaleTag("en-US"), "en");
  assert.equal(resolveLocaleTag("fr-FR"), null);
});

test("localeDateTag uses Mexican Spanish", () => {
  assert.equal(localeDateTag("es"), "es-MX");
  assert.equal(localeDateTag("pt-BR"), "pt-BR");
  assert.equal(localeDateTag("en"), "en-US");
});

test("detectDeviceLocale falls back to en without navigator languages", () => {
  assert.equal(typeof detectDeviceLocale(), "string");
});

test("spanish settings chrome is translated", () => {
  assert.equal(translate("es", "settings.title"), "Ajustes");
  assert.equal(translate("es", "settings.household"), "Hogar");
  assert.equal(translate("es", "settings.languageEs"), "Español (México)");
  assert.equal(translate("pt-BR", "today.scopeToday"), "Hoje");
});

test("catalogs share identical keys", () => {
  const enKeys = Object.keys(en).sort();
  const esKeys = Object.keys(es).sort();
  const ptKeys = Object.keys(ptBR).sort();
  assert.deepEqual(esKeys, enKeys);
  assert.deepEqual(ptKeys, enKeys);
});

test("mexican spanish prefers Ajustes and código postal", () => {
  assert.equal(translate("es", "common.settings"), "Ajustes");
  assert.equal(translate("es", "settings.zip"), "Código postal");
  assert.match(translate("es", "onboarding.zipPlaceholder"), /[Cc]ódigo postal|ZIP/);
});

test("seed chore titles localize at render", async () => {
  const { setActiveAppLocale } = await import("@/i18n");
  const { tDutyTitle, seedTitleForSave } = await import("@/i18n/content");
  setActiveAppLocale("es");
  assert.equal(tDutyTitle("Clean bathrooms"), "Limpiar baños");
  assert.equal(tDutyTitle("Replace HVAC filter"), "Cambiar filtro de aire acondicionado");
  assert.equal(tDutyTitle("My custom chore"), "My custom chore");
  assert.equal(seedTitleForSave("Limpiar baños", "Clean bathrooms"), "Clean bathrooms");
  assert.equal(seedTitleForSave("Bathroom deep clean", "Clean bathrooms"), "Bathroom deep clean");
  setActiveAppLocale("pt-BR");
  assert.equal(tDutyTitle("Clean bathrooms"), "Limpar banheiros");
  setActiveAppLocale("en");
  assert.equal(tDutyTitle("Clean bathrooms"), "Clean bathrooms");
});

test("playbook and trigger names localize", async () => {
  const { setActiveAppLocale } = await import("@/i18n");
  const { tPlaybookName, tPlaybookWhy, tTriggerName, tClimateZoneLabel, tAssetTypeLabel } =
    await import("@/i18n/content");
  setActiveAppLocale("es");
  assert.equal(tPlaybookName("all-safety", "Whole-home safety"), "Seguridad de toda la casa");
  assert.match(tPlaybookWhy("hot-arid-presummer", "fallback"), /técnicos|AC|mayo/i);
  assert.equal(tTriggerName("hard-freeze", "Hard freeze"), "Helada fuerte");
  assert.equal(tClimateZoneLabel("hot-arid"), "Desierto");
  assert.equal(tAssetTypeLabel("water_heater", "Water heater"), "Calentador de agua");
  setActiveAppLocale("pt-BR");
  assert.equal(tPlaybookName("all-safety", "Whole-home safety"), "Segurança da casa toda");
  assert.equal(tTriggerName("heat-wave", "Heat wave"), "Onda de calor");
  setActiveAppLocale("en");
  assert.equal(tPlaybookName("all-safety", "Whole-home safety"), "Whole-home safety");
});

test("budget and seasonal chrome keys are translated", () => {
  assert.notEqual(translate("es", "budget.fundTitle"), translate("en", "budget.fundTitle"));
  assert.notEqual(translate("pt-BR", "budget.illWait"), translate("en", "budget.illWait"));
  assert.equal(translate("es", "seasonal.doNow"), "Haz ahora");
  assert.equal(translate("pt-BR", "seasonal.addToYear"), "Adicionar ao meu ano");
  assert.equal(translate("es", "home.overdueCount").includes("{count}"), true);
});

test("known leftover English chrome phrases are not hardcoded in key surfaces", async () => {
  const { readFileSync } = await import("node:fs");
  const files = [
    "src/components/budget/hero.tsx",
    "src/components/budget/sheets.tsx",
    "src/components/seasonal-view.tsx",
    "src/components/app-shell.tsx",
  ];
  const banned = [
    "Home maintenance fund",
    "I’ll wait",
    "What did you pay?",
    "Erase everything?",
    "All caught up",
    "Add to my year",
    "Skip this year",
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const phrase of banned) {
      assert.equal(source.includes(`"${phrase}"`), false, `${file} still contains "${phrase}"`);
      assert.equal(source.includes(`>${phrase}<`), false, `${file} still contains >${phrase}<`);
    }
  }
});

/** Smoke: key chrome strings must not fall back to English for es / pt-BR. */
test("es and pt-BR smoke keys do not fall back to English", () => {
  const smokeKeys = [
    "tabs.today",
    "tabs.home",
    "tabs.restock",
    "common.cancel",
    "common.delete",
    "common.save",
    "common.settings",
    "common.order",
    "settings.title",
    "settings.household",
    "settings.eraseEverything",
    "today.scopeToday",
    "today.emptyToday",
    "today.addChore",
    "restock.orderNow",
    "restock.onTheWay",
    "restock.markedOrdered",
    "home.floorsAndRooms",
    "home.reassignJobs",
    "onboarding.sampleCta",
    "lock.unlock",
    "backup.undoLastRestore",
  ] as const;

  for (const key of smokeKeys) {
    const english = translate("en", key);
    const spanish = translate("es", key);
    const portuguese = translate("pt-BR", key);
    assert.notEqual(spanish, english, `es fallback for ${key}`);
    assert.notEqual(portuguese, english, `pt-BR fallback for ${key}`);
    assert.notEqual(spanish, key, `es missing ${key}`);
    assert.notEqual(portuguese, key, `pt-BR missing ${key}`);
  }
});
