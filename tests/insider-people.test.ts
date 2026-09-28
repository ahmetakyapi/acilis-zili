import test from "node:test";
import assert from "node:assert/strict";

import { displayInsiderName, matchOwner, parseForm4Owners, roleLine, translateTitle } from "../lib/insider-people";

const labels = { director: "Yönetim Kurulu Üyesi", tenPercent: "%10 Hissedar", officer: "Üst Yönetici" };

test("ad: büyük harf düzeltilir, iki kelime ve baş harfli üç kelime çevrilir", () => {
  assert.equal(displayInsiderName("MEHROTRA SANJAY"), "Sanjay Mehrotra");
  assert.equal(displayInsiderName("Sadana Sumit"), "Sumit Sadana");
  assert.equal(displayInsiderName("ALLEN SCOTT R."), "Scott R. Allen");
  assert.equal(displayInsiderName("Dugle Lynn A"), "Lynn A Dugle");
  assert.equal(displayInsiderName("O'BRIEN MARY"), "Mary O'Brien");
});

test("ad: belirsiz sıralar ve tüzel kişiler çevrilmez", () => {
  assert.equal(displayInsiderName("GRASBY PAUL DARREN"), "Grasby Paul Darren");
  assert.equal(displayInsiderName("Van Der Berg Jan"), "Van Der Berg Jan");
  assert.equal(displayInsiderName("SMITH JOHN JR"), "Smith John Jr");
  assert.equal(displayInsiderName("VANGUARD GROUP INC"), "Vanguard Group Inc");
  assert.equal(displayInsiderName("ARK INVESTMENT MANAGEMENT LLC"), "Ark Investment Management LLC");
});

const XML = `<ownershipDocument><reportingOwner><reportingOwnerId><rptOwnerName>Teter Timothy S.</rptOwnerName></reportingOwnerId>
<reportingOwnerRelationship><isDirector>0</isDirector><isOfficer>1</isOfficer><isTenPercentOwner>0</isTenPercentOwner>
<isOther>0</isOther><officerTitle>EVP, General Counsel and Sec</officerTitle><otherText></otherText></reportingOwnerRelationship>
</reportingOwner></ownershipDocument>`;

test("Form 4: sahip ve görev okunur, adla eşleşir", () => {
  const owners = parseForm4Owners(XML);
  assert.equal(owners.length, 1);
  const owner = matchOwner("TETER TIMOTHY S", owners)!;
  assert.equal(owner.officerTitle, "EVP, General Counsel and Sec");
  assert.equal(roleLine(owner, "tr", labels), "İcra Başkan Yardımcısı, Baş Hukuk Müşaviri ve Şirket Sekreteri");
  assert.equal(roleLine(owner, "en", labels), "EVP, General Counsel and Sec");
});

test("görev: kurul tekrarlanmaz, bilinmeyen unvan olduğu gibi kalır", () => {
  const base = { name: "X", director: true, officer: true, tenPercent: false, other: false, otherText: null };
  assert.equal(roleLine({ ...base, officerTitle: "Chairman & CEO" }, "tr", labels), "Yönetim Kurulu Başkanı ve CEO");
  assert.equal(roleLine({ ...base, officerTitle: "President and CEO" }, "tr", labels), "Başkan ve CEO · Yönetim Kurulu Üyesi");
  assert.equal(roleLine({ ...base, officer: false, officerTitle: null }, "tr", labels), "Yönetim Kurulu Üyesi");
  assert.equal(roleLine({ ...base, officerTitle: "See Remarks" }, "tr", labels), "Üst Yönetici · Yönetim Kurulu Üyesi");
  assert.equal(translateTitle("Head of Research and Development", "tr"), "Head of Research and Development");
  assert.equal(
    roleLine({ ...base, director: false, officer: false, tenPercent: true, officerTitle: null }, "tr", labels),
    "%10 Hissedar",
  );
});

test("eşleşme: birden fazla sahipte adsız tahmin yok", () => {
  const two = parseForm4Owners(XML + XML.replace("Teter Timothy S.", "Other Person"));
  assert.equal(matchOwner("Nobody", two), null);
});
