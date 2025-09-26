---
layout: page
permalink: /publications/
title: Publications
years: [2025, 2024, 2023]
nav: true
nav_order: 1
---

<!-- _pages/publications.md -->

<div class="publications">

{%- for y in page.years %}

  <h2 class="year">{{y}}</h2>

  {% bibliography -f papers -q @*[year={{y}}]* %}
    <ul>
    {% for entry in bibliography_data %}
        <li>
        {{entry.title}}
        {% if entry.url %}
        <a href="{{entry.url}}">[URL]</a>
        {% endif %}
        </li>
    {% endfor %}
    </ul>

{% endfor %}


</div>
