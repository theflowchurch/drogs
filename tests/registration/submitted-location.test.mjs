import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSubmittedBishop, submittedFileOwner, joinSplitBishopDetails } from '../../scripts/lib/submitted-sheet-authority.mjs';

test('a copied bishop row cannot overwrite the submission owner in either row order', () => {
  const own = {name: 'Isaac Agyeman', city: 'Accra'};
  const copied = {name: 'Edwin Ogoe', city: 'Accra'};
  const owner = submittedFileOwner('Bishop Isaac Agyeman. - Fiilled.xlsx');
  assert.equal(selectSubmittedBishop([own, copied], owner), own);
  assert.equal(selectSubmittedBishop([copied, own], owner), own);
  assert.equal(selectSubmittedBishop([copied, {name: 'Another Bishop'}], owner), null);
});
test('the owner can have a fuller name than the file while another leader appears on the sheet', () => {
  const own = {name: 'James Quist-Therson (Nii Nortey)', city: 'New York'};
  const copied = {name: 'Henrietta Ariel Orleans-Lindsay', city: 'Memphis'};
  assert.equal(selectSubmittedBishop([own, copied], submittedFileOwner('Nii Nortey Quist Therson First_Love_North_America_Pastors_Updated.xlsx')), own);
});
test('a name-only line completes a bishop detail row without borrowing another person’s fields', () => {
  const map = {name: 0, rank: 2, city: 3, country: 4};
  const details = ['Full Name', 'Male', 'Bishop', 'Hamburg', 'Germany'];
  assert.deepEqual(joinSplitBishopDetails(details, ['Michael Amoh', '', '', '', ''], map), ['Michael Amoh', 'Male', 'Bishop', 'Hamburg', 'Germany']);
  assert.equal(joinSplitBishopDetails(details, ['Another Person', '', 'Pastor', 'Berlin', 'Germany'], map), null);
  assert.deepEqual(details, ['Full Name', 'Male', 'Bishop', 'Hamburg', 'Germany']);
});
