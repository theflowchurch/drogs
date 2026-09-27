import json, os
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
    def login(email, admin=False):
        page.goto(BASE + ('/admin' if admin else '/'))
        page.wait_for_load_state('networkidle')
        expect(page.get_by_label('Platform password')).not_to_be_visible()
        expect(page.get_by_text('Demo ·', exact=False)).not_to_be_visible()
        page.get_by_label('Email address', exact=True).fill(email)
        page.get_by_role('button', name='Send sign-in code').click()
        page.get_by_label('One-time email code').wait_for()
        import re
        mail = next(m for m in reversed(json.loads((MEDIA/'mail.json').read_text())) if m['to'] == email)
        token = re.search(r'code is (\d{6})', mail['text'])[1]
        page.get_by_label('One-time email code').fill(token)
        page.get_by_role('button', name='Verify and sign in').click()
        page.locator('main').wait_for()
    try:
        login('browser-member@example.com')
        page.get_by_label('Registering as').select_option('bishop')
        for label, value in [('First name','Browser'),('Last name','Bishop'),('Phone number','+233201234567'),('Date of birth','1990-02-01'),('Country','Ghana'),('City','Accra')]:
            page.get_by_label(label, exact=True).fill(value)
        page.get_by_label('Organization',exact=True).select_option('First Love')
        page.get_by_label('Denomination',exact=True).select_option('First Love Church')
        page.get_by_label('Photo in official attire',exact=True).set_input_files(str(ROOT/'assets/outreach/brian-masuku.png'))
        expect(page.get_by_text('Photo uploaded. Choose a new image to replace it.')).to_be_visible()
        page.get_by_role('button',name='Save draft').click()
        expect(page.get_by_text('Draft saved. You can return to finish it.')).to_be_visible()
        page.reload();page.wait_for_load_state('networkidle')
        expect(page.get_by_label('First name',exact=True)).to_have_value('Browser')
        page.set_viewport_size({'width':390,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.get_by_role('button',name='Review registration').click()
        expect(page.get_by_alt_text('Your uploaded photo for confirmation')).to_be_visible()
        assert page.get_by_alt_text('Your uploaded photo for confirmation').evaluate('(img) => img.complete && img.naturalWidth > 0')
        page.get_by_label('I confirm that these details').check()
        page.get_by_label('I confirm this is me').check()
        page.get_by_role('button',name='Submit registration').click()
        expect(page.get_by_text('Your registration has been received.')).to_be_visible()
        assert page.evaluate("localStorage.getItem('drogs-registration-v1')") is None
        page.get_by_role('button',name='Sign out',exact=True).click()
        page.get_by_label('Email address',exact=True).wait_for()
        page.set_viewport_size({'width':1440,'height':1050})
        login('browser-office@example.com', True)
        assert page.url.endswith('/admin/')
        page.get_by_role('button',name='Bishop approvals',exact=True).click()
        page.get_by_role('button',name='Browser Bishop').click()
        expect(page.get_by_text('Browser Bishop',exact=True).first).to_be_visible()
        # Close the registration dialog before managing integration keys.
        page.get_by_role('button',name='Close',exact=True).click()
        page.get_by_role('button',name='Accounts',exact=True).click()
        page.get_by_label('Find an account',exact=True).fill('browser-member@example.com')
        page.get_by_role('button',name='Search accounts',exact=True).click()
        expect(page.get_by_text('1 matching accounts',exact=False)).to_be_visible()
        page.get_by_role('button',name='View logins (1)',exact=True).click()
        expect(page.get_by_role('region',name='Account login history')).to_contain_text('Email verified')
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
        page.get_by_role('button',name='Revoke Browser integration',exact=True).click()
        page.get_by_role('button',name='Confirm revoke',exact=True).click()
        expect(page.get_by_role('status')).to_contain_text('API key revoked.')
        expect(page.get_by_role('button',name='Revoke Browser integration',exact=True)).not_to_be_visible()
        assert errors == [], errors
        print('MySQL browser flow passed: emailed sign-in, R2 portrait, draft reload, submission, mobile layout and admin access to shared registration.')
    except Exception:
        page.screenshot(path='/tmp/drogs-mysql-browser-failure.png',full_page=True)
        print(page.locator('body').inner_text()[:4000],flush=True)
        raise
    finally:
        browser.close()
