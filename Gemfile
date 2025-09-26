source "https://rubygems.org"
ruby "3.2.9"          # important: matches the workflow runner

# Core
gem "jekyll", "~> 4.3"

# Plugins actually used by al-folio
group :jekyll_plugins do
  gem "jekyll-include-cache"
  gem "jekyll-archives"
  gem "jekyll-diagrams"
  gem "jekyll-email-protect"
  gem "jekyll-feed"
  # gem "jekyll-imagemagick"   # comment out unless you really need it
  gem "jekyll-minifier"
  gem "jekyll-paginate-v2"
  gem "jekyll-scholar"
  gem "jekyll-sitemap"
  gem "jekyll-link-attributes"
  gem "jekyll-twitter-plugin"
  gem "jemoji"
  gem "webrick"                # needed for local serve on Ruby 3.x
  gem "mini_racer"             # only if you need ExecJS; keep if site expects it
  gem "unicode_utils"
end

# Optional extras your site may use
group :other_plugins do
  gem "httparty"
  gem "feedjira"
end
