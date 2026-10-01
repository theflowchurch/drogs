import re
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
BASE=os.environ.get('DROGS_BASE_URL','http://127.0.0.1:4207/drogs-registration').rstrip('/')
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(os.environ.get('DROGS_SCREENSHOTS','/tmp/drogs-registration-qa'));OUT.mkdir(parents=True,exist_ok=True)
PHOTO=str(ROOT/'assets/pastors/reconciled-5.webp')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('PLAYWRIGHT_EXECUTABLE_PATH','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'))
 context=browser.new_context(viewport={'width':1440,'height':1050})
 page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 def open_account(email,office=False):
  page.goto(BASE+('/admin/' if office else '/signup/'));page.wait_for_load_state('networkidle')
  if page.get_by_label('Access code').is_visible():
   page.get_by_label('Access code').fill('1234');page.get_by_role('button',name='Enter →').click()
  if page.get_by_role('button',name='Sign up',exact=True).is_visible():page.get_by_role('button',name='Sign up',exact=True).click()
  page.get_by_label('Email address',exact=True).fill(email)
  page.get_by_role('button',name='Continue →').click()
  page.locator('main').wait_for()
 def signout():
  page.get_by_role('button',name='Sign out',exact=True).click();page.get_by_role('link',name='View the full Pastoral directory').wait_for()
 def register(name,role='pastor',bishop='B1'):
  page.get_by_label('Ministerial title').select_option(role)
  page.get_by_label('Organization',exact=True).select_option('First Love')
  page.get_by_label('First name',exact=True).fill(name.split(' ')[0]);page.get_by_label('Last name',exact=True).fill(' '.join(name.split(' ')[1:]))
  page.get_by_label('Gender',exact=True).select_option('male')
  page.get_by_label('WhatsApp number').fill('+233201234567')
  page.get_by_label('Date of birth').fill('1990-02-01')
  page.get_by_label('Denomination',exact=True).select_option('First Love Church');page.get_by_label('Country where you currently serve',exact=True).fill('Ghana');page.get_by_label('City',exact=True).fill('Accra')
  choices=page.get_by_label('Denomination',exact=True).locator('option').all_text_contents();assert len(choices)==8 and 'Go Ye Church' in choices
  for org in ['DHMM','FLOW','HJC']:
   page.get_by_label('Organization',exact=True).select_option(org);expect(page.get_by_label('Denomination',exact=True)).not_to_be_visible()  # no denominations → the field is hidden
  page.get_by_label('Organization',exact=True).select_option('First Love');expect(page.get_by_label('Denomination',exact=True)).to_have_value('');page.get_by_label('Denomination',exact=True).select_option('First Love Church')
  if role=='pastor':page.get_by_label('Your bishop').select_option(label='Demo Bishop · First Love Church');expect(page.get_by_text('Demo Bishop',exact=True)).to_be_visible()
  page.get_by_label('Photo in official attire',exact=True).set_input_files(PHOTO)
  expect(page.get_by_text('Photo uploaded · tap to replace it')).to_be_visible()
 def submit():
  page.get_by_role('button',name='Continue →').click()
  if page.get_by_role('heading',name='Add pastors under your oversight',exact=True).is_visible(): page.get_by_role('button',name='Continue →').click()
  page.get_by_role('button',name='Continue →').click()
  page.get_by_label('I confirm that these details').check(); page.get_by_label('I consent to Kuriake Castle').check()
  expect(page.get_by_role('button',name='Confirm and submit →')).to_be_disabled()
  expect(page.get_by_alt_text('Your uploaded photo for confirmation')).to_be_visible()
  page.get_by_label('I confirm this is me').check()
  page.screenshot(path=str(OUT/('portrait-review-'+str(len(list(OUT.glob('portrait-review*'))))+'.png')),full_page=True)
  page.get_by_role('button',name='Confirm and submit →').click()
  expect(page.get_by_role('heading',name='Your Details',exact=True)).not_to_be_visible()
  expect(page.get_by_role('heading',name=re.compile('^Thank you, '))).to_be_visible()
 try:
  page.goto(BASE+'/');page.wait_for_load_state('networkidle');page.screenshot(path=str(OUT/'entrance.png'),full_page=True)
  page.evaluate("localStorage.setItem('drogs-2027',JSON.stringify({legacy:'untouched'}))")
  open_account('bishop@example.com');register('Demo Bishop','bishop');page.screenshot(path=str(OUT/'bishop-form.png'),full_page=True);submit()
  expect(page.get_by_text('Your bishop account is awaiting verification.')).to_be_visible()
  expect(page.get_by_text('$100',exact=False).first).to_be_visible()
  signout();open_account('office@example.com',True)
  expect(page.get_by_text('Existing records',exact=True)).to_be_visible()
  assert page.locator('.reg-dot.stale').count()>0 and page.locator('.reg-dot.updated').count()==0
  page.get_by_role('button',name='Approvals',exact=True).click();page.get_by_role('button',name='Demo Bishop').click()
  page.get_by_label('Match to existing bishop reference').select_option('B1');page.get_by_label('I have verified this person').check();page.get_by_role('button',name='Confirm bishop').click()
  expect(page.get_by_text('No bishop registrations awaiting confirmation')).to_be_visible()
  signout();open_account('bishop@example.com');page.get_by_role('button',name='My pastors',exact=True).click()
  page.get_by_label('Pastor 1 full name',exact=True).fill('Jon Demo');page.get_by_label('Pastor 1 date of birth',exact=True).fill('1988-07-14')  # wrong birthday: John stays Unclaimed until the office links him
  page.get_by_role('button',name='Add to my list →',exact=True).click();expect(page.get_by_role('cell',name='Jon Demo',exact=True)).to_be_visible()
  signout();open_account('pastor@example.com');register('John Demo')
  page.get_by_role('button',name='Save draft').click();expect(page.get_by_text('Draft saved. You can return to finish it.')).to_be_visible()
  page.reload();page.wait_for_load_state('networkidle');expect(page.get_by_label('First name',exact=True)).to_have_value('John')
  page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(OUT/'mobile-form.png'),full_page=True)
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  page.get_by_role('button',name='Continue →').click();page.get_by_role('button',name='Continue →').click();expect(page.get_by_role('button',name='Confirm and submit →')).to_be_disabled()
  page.get_by_role('button',name='← Back').click();page.get_by_role('button',name='← Back').click();expect(page.get_by_label('First name',exact=True)).to_have_value('John');submit()
  expect(page.get_by_text('Thank you. Your registration is being processed.')).to_be_visible()
  page.screenshot(path=str(OUT/'mobile-unclaimed-status.png'),full_page=True)
  signout();page.set_viewport_size({'width':1440,'height':1050});open_account('office@example.com',True)
  page.get_by_role('button',name='Directory',exact=True).click()
  page.get_by_label('Search people').fill('John Demo');expect(page.get_by_role('button',name='John Demo')).not_to_be_visible()
  page.get_by_label('Search people').fill('')
  page.get_by_role('button',name='Unclaimed').click();page.screenshot(path=str(OUT/'unclaimed-office.png'),full_page=True)
  page.get_by_role('button',name='John Demo').click();page.screenshot(path=str(OUT/'unclaimed-review.png'),full_page=True)
  opts=page.get_by_label('Link to annual list').locator('option').all_text_contents();assert any('Jon Demo' in o for o in opts)
  page.get_by_label('Link to annual list').select_option(index=1);page.get_by_role('button',name='Confirm pastor · unlock payment').click()
  expect(page.get_by_text('No Unclaimed registrations',exact=True)).to_be_visible()
  page.get_by_role('button',name='Directory',exact=True).click()
  page.get_by_role('button',name='Pastors',exact=True).click();page.get_by_label('Search people').fill('John Demo')
  expect(page.get_by_role('button',name='John Demo')).to_be_visible();page.screenshot(path=str(OUT/'directory.png'),full_page=True)
  page.get_by_label('Search people').fill('')
  page.set_viewport_size({'width':390,'height':844});page.evaluate('() => Promise.all(Array.from(document.images).map(i => i.decode().catch(() => {})))');page.evaluate('() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');assert page.locator('.reg-header').count()==1;page.screenshot(path=str(OUT/'mobile-directory.png'),full_page=True);context.storage_state(path=str(OUT/'browser-state.json'),indexed_db=True);assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  signout();open_account('pastor@example.com');expect(page.get_by_text('Your registration is confirmed.')).to_be_visible()
  page.get_by_role('button',name='Directory',exact=True).click()
  page.get_by_label('Search people').fill('Abednego');page.get_by_role('button',name='Abednego Nyarkoh-Mensah').click()
  expect(page.get_by_text('Cape Verde',exact=False).first).to_be_visible()
  assert 'abedsah' not in page.locator('.reg-dialog, dialog, body').first.inner_text().lower(),'members never see contact details'
  page.screenshot(path=str(OUT/'member-directory.png'),full_page=True)
  page.keyboard.press('Escape');page.get_by_role('button',name='Registration',exact=True).click()
  expect(page.get_by_text('Payment awaiting verification',exact=True)).to_be_visible()
  signout();page.set_viewport_size({'width':1440,'height':1050});open_account('office@example.com',True);page.get_by_role('button',name='Payments',exact=True).click()
  page.get_by_role('button',name='John Demo').click();page.get_by_role('button',name='Verify received payment').click();expect(page.get_by_text('No payments waiting',exact=True)).to_be_visible()
  page.get_by_role('button',name='Annual lists',exact=True).click();page.get_by_role('button',name='Remove',exact=True).click();page.get_by_label('Reason',exact=True).select_option('Dismissed');page.get_by_role('button',name='Confirm removal').click();expect(page.get_by_text('Dismissed',exact=True)).to_be_visible()
  page.get_by_role('button',name='History',exact=True).click();page.get_by_role('button',name='Start 2028 registration',exact=True).click();page.get_by_role('dialog').get_by_role('button',name='Start 2028 registration',exact=True).click();expect(page.get_by_text('2028 annual registration',exact=True)).to_be_visible()
  page.get_by_role('button',name='Directory',exact=True).click();page.get_by_label('Annual cycle',exact=True).select_option('2028')
  assert page.locator('.reg-dot.updated').count()==0,'a new cycle starts with no updated records'
  state=page.evaluate("JSON.parse(localStorage.getItem('drogs-registration-v1'))")
  assert state['year']==2028
  assert len([r for r in state['registrations'] if r['year']==2028])==0
  assert any(r['payment']=='verified' and r['status']=='removed' for r in state['registrations'])
  assert page.evaluate("JSON.parse(localStorage.getItem('drogs-2027')).legacy")=='untouched'
  assert errors==[],errors
  print('Browser checks passed: registration, saved drafts, office bishop verification, annual roster, Unclaimed isolation, manual linking, payment locking/proof/verification, removal, annual reset, preserved legacy data, desktop and mobile.')
 except Exception:
  page.screenshot(path=str(OUT/'failure.png'),full_page=True)
  print(page.locator('body').inner_text()[:5000],flush=True)
  raise
 finally:browser.close()
