<h2 id="publications" style="margin: 2px 0px -15px;">Publications</h2>

<div class="publications">

  {%- comment -%} ---------- PAPERS: pdf가 있는 항목 ---------- {%- endcomment -%}
  {%- assign has_papers = false -%}
  {%- for link in site.data.publications.main -%}
    {%- if link.pdf -%}{%- assign has_papers = true -%}{%- break -%}{%- endif -%}
  {%- endfor -%}
  {%- if has_papers -%}
  <ol class="bibliography">
    {%- for link in site.data.publications.main -%}
      {%- if link.pdf -%}
      <li>
        <div class="pub-row">
          <div class="col-sm-3 abbr" style="position: relative; padding-right: 15px; padding-left: 15px;">
            {%- if link.image -%}
              <img src="{{ link.image }}" class="teaser img-fluid z-depth-1" style="max-width:100%; height:auto">
              {%- if link.conference_short -%}<abbr class="badge">{{ link.conference_short }}</abbr>{%- endif -%}
            {%- endif -%}
          </div>
          <div class="col-sm-9" style="position: relative; padding-right: 15px; padding-left: 20px;">
            <div class="title">{% if link.pdf %}<a href="{{ link.pdf }}">{% endif %}{{ link.title }}{% if link.pdf %}</a>{% endif %}</div>
            <div class="author">{{ link.authors }}</div>
            <div class="periodical"><em>{{ link.conference }}</em></div>
            <div class="links">
              {% if link.pdf %}<a href="{{ link.pdf }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Paper</a>{% endif %}
              {% if link.code %}<a href="{{ link.code }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Code</a>{% endif %}
              {% if link.page %}<a href="{{ link.page }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Project</a>{% endif %}
              {% if link.bibtex %}<a href="{{ link.bibtex }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">BibTex</a>{% endif %}
              {% if link.notes %}<strong><i style="color:#e74d3c">{{ link.notes }}</i></strong>{% endif %}
              {% if link.others %}{{ link.others }}{% endif %}
            </div>
          </div>
        </div>
      </li>
      <br>
      {%- endif -%}
    {%- endfor -%}
  </ol>
  {%- endif -%}

  {%- comment -%} ---------- PROJECTS: page는 있고 pdf는 없는 항목 ---------- {%- endcomment -%}
  {%- assign has_projects = false -%}
  {%- for link in site.data.publications.main -%}
    {%- if link.page and link.pdf == nil -%}{%- assign has_projects = true -%}{%- break -%}{%- endif -%}
  {%- endfor -%}
  {%- if has_projects -%}
  <h3 style="margin-top:18px;">Projects</h3>
  <ol class="bibliography">
    {%- for link in site.data.publications.main -%}
      {%- if link.page and link.pdf == nil -%}
      <li>
        <div class="pub-row">
          <div class="col-sm-3 abbr" style="position: relative; padding-right: 15px; padding-left: 15px;">
            {%- if link.image -%}<img src="{{ link.image }}" class="teaser img-fluid z-depth-1" style="max-width:100%; height:auto">{%- endif -%}
          </div>
          <div class="col-sm-9" style="position: relative; padding-right: 15px; padding-left: 20px;">
            <div class="title">{% if link.page %}<a href="{{ link.page }}">{% endif %}{{ link.title }}{% if link.page %}</a>{% endif %}</div>
            <div class="author">{{ link.authors }}</div>
            <div class="periodical"><em>{{ link.conference }}</em></div>
            <div class="links">
              {% if link.page %}<a href="{{ link.page }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Project</a>{% endif %}
              {% if link.code %}<a href="{{ link.code }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Code</a>{% endif %}
              {% if link.pdf %}<a href="{{ link.pdf }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Paper</a>{% endif %}
              {% if link.bibtex %}<a href="{{ link.bibtex }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">BibTex</a>{% endif %}
              {% if link.notes %}<strong><i style="color:#e74d3c">{{ link.notes }}</i></strong>{% endif %}
              {% if link.others %}{{ link.others }}{% endif %}
            </div>
          </div>
        </div>
      </li>
      <br>
      {%- endif -%}
    {%- endfor -%}
  </ol>
  {%- endif -%}

  {%- comment -%} ---------- CODE: code만 있고(pdf/page 없음) ---------- {%- endcomment -%}
  {%- assign has_codes = false -%}
  {%- for link in site.data.publications.main -%}
    {%- if link.code and link.pdf == nil and link.page == nil -%}{%- assign has_codes = true -%}{%- break -%}{%- endif -%}
  {%- endfor -%}
  {%- if has_codes -%}
  <h3 style="margin-top:18px;">Code</h3>
  <ol class="bibliography">
    {%- for link in site.data.publications.main -%}
      {%- if link.code and link.pdf == nil and link.page == nil -%}
      <li>
        <div class="pub-row">
          <div class="col-sm-3 abbr" style="position: relative; padding-right: 15px; padding-left: 15px;">
            {%- if link.image -%}<img src="{{ link.image }}" class="teaser img-fluid z-depth-1" style="max-width:100%; height:auto">{%- endif -%}
          </div>
          <div class="col-sm-9" style="position: relative; padding-right: 15px; padding-left: 20px;">
            <div class="title">{% if link.code %}<a href="{{ link.code }}">{% endif %}{{ link.title }}{% if link.code %}</a>{% endif %}</div>
            <div class="author">{{ link.authors }}</div>
            <div class="periodical"><em>{{ link.conference }}</em></div>
            <div class="links">
              {% if link.code %}<a href="{{ link.code }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Code</a>{% endif %}
              {% if link.page %}<a href="{{ link.page }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Project</a>{% endif %}
              {% if link.pdf %}<a href="{{ link.pdf }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Paper</a>{% endif %}
              {% if link.bibtex %}<a href="{{ link.bibtex }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">BibTex</a>{% endif %}
              {% if link.notes %}<strong><i style="color:#e74d3c">{{ link.notes }}</i></strong>{% endif %}
              {% if link.others %}{{ link.others }}{% endif %}
            </div>
          </div>
        </div>
      </li>
      <br>
      {%- endif -%}
    {%- endfor -%}
  </ol>
  {%- endif -%}

</div>
