import os, re, json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[2]
MEDIA = Path(os.environ['TEST_MEDIA_DIR'])
BASE = 'http://127.0.0.1:4208'
with sync_playwright() as p:
    args = {'headless': True}
    if os.environ.get('PLAYWRIGHT_EXECUTABLE_PATH'):
        args['executable_path'] = os.environ['PLAYWRIGHT_EXECUTABLE_PATH']
    browser = p.chromium.launch(**args)
    context = browser.new_context(viewport={'width': 1440, 'height': 1050})
    def image(route):
        path = urlparse(route.request.url).path.encode().hex()
        route.fulfill(status=200, content_type='image/webp', body=(MEDIA/path).read_bytes())
    context.route('**r2.cloudflarestorage.com/**', image)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    def login(admin=False):
        page.goto(BASE + ('/admin' if admin else '/signup/'))
        page.wait_for_load_state('networkidle')
        expect(page.get_by_text('Demo ·', exact=False)).not_to_be_visible()
        if admin:
            page.get_by_label('Access code', exact=True).fill('admin-test-code')
            page.get_by_role('button', name='Enter →').click()
            page.get_by_label('Email address', exact=True).fill('browser-office@example.com')
            page.get_by_role('button', name='Send code').click()
            page.get_by_label('One-time email code').wait_for()
            code = re.search(r'code is (\d{6})', json.loads((MEDIA/'mail.json').read_text())[-1]['text']).group(1)
            page.get_by_label('One-time email code').fill(code)
            page.get_by_role('button', name='Verify and sign in').click()
        else:
            page.get_by_role('button', name='Sign up', exact=True).click()
            page.get_by_label('Email address', exact=True).fill('browser-member@example.com')
            page.get_by_role('button', name='Send code').click()
            page.get_by_label('One-time email code').wait_for()
            code = re.search(r'code is (\d{6})', json.loads((MEDIA/'mail.json').read_text())[-1]['text']).group(1)
            page.get_by_label('One-time email code').fill(code)
            page.get_by_role('button', name='Verify and create account').click()
        page.locator('main').wait_for()
    try:
        login()
        page.get_by_label('Ministerial Category').select_option('bishop')
        for label, value in [('First name','Browser'),('Last name','Bishop'),('WhatsApp number','+233201234567'),('Date of birth','1990-02-01'),('Country where you currently serve','Ghana'),('City','Accra')]:
            page.get_by_label(label, exact=True).fill(value)
        page.get_by_label('Gender',exact=True).select_option('male')
        page.get_by_label('Organization',exact=True).select_option('First Love')
        page.get_by_label('Denomination',exact=True).select_option('First Love Church')
        page.get_by_label('Photo in official attire',exact=True).set_input_files(str(ROOT/'assets/outreach/brian-masuku.png'))
        expect(page.get_by_text('Photo uploaded · tap to replace it')).to_be_visible()
        page.get_by_role('button',name='Save draft').click()
        expect(page.get_by_text('Draft saved. You can return to finish it.')).to_be_visible()
        page.reload();page.wait_for_load_state('networkidle')
        expect(page.get_by_label('First name',exact=True)).to_have_value('Browser')
        page.set_viewport_size({'width':390,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.get_by_role('button',name='Continue →').click()
        # Guided onboarding for a bishop: pastors, then payment, then review.
        page.get_by_label('Pastor 1 full name',exact=True).fill('Jon Demo')
        page.get_by_label('Pastor 1 date of birth',exact=True).fill('1988-07-14')
        expect(page.get_by_text('1 pastor ready to submit',exact=False)).to_be_visible()
        page.get_by_role('button',name='Continue →').click()
        page.get_by_role('button',name='Continue →').click()
        expect(page.get_by_alt_text('Your uploaded photo for confirmation')).to_be_visible()
        expect(page.get_by_role('cell',name='Jon Demo',exact=True)).to_be_visible()  # review page repeats the pastors table
        assert page.get_by_alt_text('Your uploaded photo for confirmation').evaluate('(img) => img.complete && img.naturalWidth > 0')
        page.get_by_label('I confirm that these details').check(); page.get_by_label('I consent to Kuriake Castle').check()
        page.get_by_label('I confirm this is me').check()
        page.get_by_role('button',name='Confirm and submit →').click()
        expect(page.get_by_text('Your registration is complete.')).to_be_visible()
        expect(page.get_by_text('1 pastor uploaded.')).to_be_visible()
        assert page.evaluate("localStorage.getItem('drogs-registration-v1')") is None
        page.get_by_role('button',name='Sign out',exact=True).click()
        page.get_by_role('link', name='View the full Pastoral directory').wait_for()  # members land on the front page
        assert page.url.rstrip('/') == BASE.rstrip('/'), page.url
        page.set_viewport_size({'width':1440,'height':1050})
        login(True)
        assert page.url.endswith('/admin/')
        page.get_by_role('button',name='Approvals',exact=True).click()
        page.get_by_role('button',name='Browser Bishop').click()
        expect(page.get_by_text('Browser Bishop',exact=True).first).to_be_visible()
        # Close the registration dialog before managing integration keys.
        page.get_by_role('button',name='Close',exact=True).click()
        page.get_by_role('button',name='Accounts',exact=True).click()
        page.get_by_label('Find an account',exact=True).fill('browser-member@example.com')
        page.get_by_role('button',name='Search',exact=True).click()
        expect(page.get_by_text('1 matching account',exact=False)).to_be_visible()
        page.get_by_role('button',name='View logins (1)',exact=True).click()
        expect(page.get_by_role('region',name='Account login history')).to_contain_text('Signed in')
        page.set_viewport_size({'width':390,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.set_viewport_size({'width':1440,'height':1050})
        page.get_by_role('button',name='API keys',exact=True).click()
        page.get_by_label('Application name',exact=True).fill('Browser integration')
        page.get_by_role('button',name='Create API key',exact=True).click()
        expect(page.get_by_label('New API key',exact=True)).to_be_visible()
        key = page.get_by_label('New API key',exact=True).input_value()
        assert key.startswith('drogs_live_')
        page.get_by_role('button',name='I’ve saved this key',exact=True).click()
        expect(page.get_by_label('New API key',exact=True)).not_to_be_visible()
        page.reload();page.wait_for_load_state('networkidle')
        page.get_by_role('button',name='API keys',exact=True).click()
        expect(page.get_by_role('heading',name='Browser integration',exact=True)).to_be_visible()
        page.get_by_role('button',name='Revoke access for Browser integration',exact=True).click()
        page.get_by_role('button',name='Confirm revoke',exact=True).click()
        expect(page.get_by_role('status')).to_contain_text('API key revoked.')
        expect(page.get_by_role('button',name='Revoke access for Browser integration',exact=True)).not_to_be_visible()
        assert errors == [], errors
        print('MySQL browser flow passed: emailed sign-in, R2 portrait, draft reload, submission, mobile layout and admin access to shared registration.')
    except Exception:
        page.screenshot(path='/tmp/drogs-mysql-browser-failure.png',full_page=True)
        print(page.locator('body').inner_text()[:4000],flush=True)
        raise
    finally:
        browser.close()
