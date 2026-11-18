"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {currentWeek, closureReason, dayNumber} = require("../mittagstisch.js");
const menu = require("../templates/mittagstisch-menu.json");
const week = iso => currentWeek(new Date(iso));
test("All 12 weeks have four complete menus in service order", () => {
  assert.equal(menu.weeks.length, 12);
  const used = new Set();
  for (const days of menu.weeks) {
    assert.equal(days.length, 4);
    for (const {dishes, side} of days) {
      assert.equal(dishes.length, 4);
      assert.ok(side);
      for (const dish of dishes) { assert.ok(menu.recipes[dish]); used.add(dish); }
    }
  }
  assert.equal(used.size, Object.keys(menu.recipes).length);
  assert.deepEqual([menu.weeks[8][0].dishes[0], menu.weeks[8][0].side], ["Pollo alla Cacciatora", "Pommes frites"]);
  assert.equal(menu.weeks[0][2].dishes[0], "Putengeschnetzeltes al Curry");
  assert.equal(menu.weeks[2][2].dishes[0], "Putengeschnetzeltes al Curry");
});
test("Berlin midnight preview, including the launch weekend and year boundary", () => {
  for (const [iso, idx, selected] of [
    ["2026-11-20T22:59:59Z", -1, 3], ["2026-11-20T23:00:00Z", 0, 0],
    ["2026-11-27T22:59:59Z", 0, 3], ["2026-11-27T23:00:00Z", 1, 0],
    ["2026-11-29T12:00:00Z", 1, 0], ["2026-11-29T23:00:00Z", 1, 0],
    ["2026-12-30T12:00:00Z", 5, -1], ["2027-01-01T12:00:00Z", 5, 3],
    ["2027-02-12T22:59:59Z", 11, 3], ["2027-02-12T23:00:00Z", 0, 0],
    ["2027-02-15T12:00:00Z", 0, 0],
  ]) {
    const actual = week(iso);
    assert.deepEqual([actual.weekIndex, actual.selection], [idx, selected], iso);
  }
  for (const iso of ["2027-03-28T00:59:59Z", "2027-03-28T01:00:00Z", "2027-10-31T00:59:59Z", "2027-10-31T01:00:00Z"]) {
    assert.equal(week(iso).weekend, true);
    assert.equal(week(iso).selection, 0);
  }
  assert.equal(week("2027-07-02T21:59:59Z").weekend, false);
  assert.equal(week("2027-07-02T22:00:00Z").weekend, true);
  const summer = week("2027-07-02T22:00:00Z");
  assert.equal(summer.monday, dayNumber(2027, 7, 5));
});
test("Statutory BW holidays, regular service dates and inclusive restaurant closures", () => {
  for (const iso of ["2026-12-25","2026-12-26","2027-01-01","2027-01-06","2027-03-26","2027-03-29","2027-05-01","2027-05-06","2027-05-17","2027-05-27","2027-10-03","2027-11-01"]) {
    assert.match(closureReason(Date.parse(iso) / 86400000, []), /Feiertag/, iso);
  }
  for (const iso of ["2026-12-24","2026-12-31"]) assert.equal(closureReason(Date.parse(iso) / 86400000, []), "");
  const closures = [{from:"2026-11-30",to:"2026-12-01"}];
  for (const iso of ["2026-11-30","2026-12-01"]) assert.match(closureReason(Date.parse(iso) / 86400000, closures), /Betriebsferien/);
  assert.equal(closureReason(dayNumber(2026,12,3),closures), "");
  assert.deepEqual(menu.closures, []);
});
