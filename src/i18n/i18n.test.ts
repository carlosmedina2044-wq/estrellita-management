import assert from "node:assert/strict";
import { test } from "node:test";
import { detectDeviceLocale, resolveLocaleTag, translate } from "@/i18n";

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

test("spanish settings chrome is translated", () => {
  assert.equal(translate("es", "settings.title"), "Ajustes");
  assert.equal(translate("es", "settings.household"), "Hogar");
  assert.equal(translate("pt-BR", "today.scopeToday"), "Hoje");
});
