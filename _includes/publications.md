<h2 id="publications" style="margin: 2px 0px -15px;">Publications</h2>

{% assign all = site.data.publications.main %}

{%- comment -%}
자동 분류 규칙
- Papers   : i.pdf != nil
- Projects : i.page != nil AND i.pdf == nil
- Code     : i.code != nil AND i.pdf == nil AND i.page == nil
{%- endcomment -%}

{% assign papers   = all | where_exp: "i", "i.pdf != nil" %}
{% assign projects = all | where_exp: "i", "i.page != nil and i.pdf == nil" %}
{% assign codes    = all | where_exp: "i", "i.code != nil and i.pdf == nil and i.page == nil" %}

<div class="publications">

  {%- if papers and papers.size > 0 -%}
  <h3 style="margin-top:18px;">Papers</h3>
  <ol class="bibliography">
    {%- for link in papers -%}
    <li>
      <div class="pub-row">
        <div class="col-sm-3 abbr" style="position: relative;padding-right: 15px;padding-left: 15px;">
          {%- if link.image -%}
          <img src="{{ link.image }}" class="teaser img-fluid z-depth-1" style="max-width:100%;height:auto">
          {%- if link.conference_short -%}<abbr class="badge">{{ link.conference_short }}</abbr>{%- endif -%}
          {%- endif -%}
        </div>
        <div class="col-sm-9" style="position: relative;padding-right: 15px;padding-left: 20px;">
          <div class="title">{% if link.pdf %}<a href="{{ link.pdf }}">{% endif %}{{ link.title }}{% if link.pdf %}</a>{% endif %}</div>
          <div class="author">{{ link.authors }}</div>
          <div class="periodical"><em>{{ link.conference }}</em></div>
          <div class="links">
            {% if link.pdf %}<a href="{{ link.pdf }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">PDF</a>{% endif %}
            {% if link.code %}<a href="{{ link.code }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Code</a>{% endif %}
            {% if link.page %}<a href="{{ link.page }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Project Page</a>{% endif %}
            {% if link.bibtex %}<a href="{{ link.bibtex }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">BibTex</a>{% endif %}
            {% if link.notes %}<strong><i style="color:#e74d3c">{{ link.notes }}</i></strong>{% endif %}
            {% if link.others %}{{ link.others }}{% endif %}
          </div>
        </div>
      </div>
    </li>
    <br>
    {%- endfor -%}
  </ol>
  {%- endif -%}

  {%- if projects and projects.size > 0 -%}
  <h3 style="margin-top:18px;">Projects</h3>
  <ol class="bibliography">
    {%- for link in projects -%}
    <li>
      <div class="pub-row">
        <div class="col-sm-3 abbr" style="position: relative;padding-right: 15px;padding-left: 15px;">
          {%- if link.image -%}<img src="{{ link.image }}" class="teaser img-fluid z-depth-1" style="max-width:100%;height:auto">{%- endif -%}
        </div>
        <div class="col-sm-9" style="position: relative;padding-right: 15px;padding-left: 20px;">
          <div class="title">{% if link.page %}<a href="{{ link.page }}">{% endif %}{{ link.title }}{% if link.page %}</a>{% endif %}</div>
          <div class="author">{{ link.authors }}</div>
          <div class="periodical"><em>{{ link.conference }}</em></div>
          <div class="links">
            {% if link.page %}<a href="{{ link.page }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Project Page</a>{% endif %}
            {% if link.code %}<a href="{{ link.code }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Code</a>{% endif %}
            {% if link.pdf %}<a href="{{ link.pdf }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">PDF</a>{% endif %}
            {% if link.bibtex %}<a href="{{ link.bibtex }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">BibTex</a>{% endif %}
            {% if link.notes %}<strong><i style="color:#e74d3c">{{ link.notes }}</i></strong>{% endif %}
            {% if link.others %}{{ link.others }}{% endif %}
          </div>
        </div>
      </div>
    </li>
    <br>
    {%- endfor -%}
  </ol>
  {%- endif -%}

  {%- if codes and codes.size > 0 -%}
  <h3 style="margin-top:18px;">Code</h3>
  <ol class="bibliography">
    {%- for link in codes -%}
    <li>
      <div class="pub-row">
        <div class="col-sm-3 abbr" style="position: relative;padding-right: 15px;padding-left: 15px;">
          {%- if link.image -%}<img src="{{ link.image }}" class="teaser img-fluid z-depth-1" style="max-width:100%;height:auto">{%- endif -%}
        </div>
        <div class="col-sm-9" style="position: relative;padding-right: 15px;padding-left: 20px;">
          <div class="title">{% if link.code %}<a href="{{ link.code }}">{% endif %}{{ link.title }}{% if link.code %}</a>{% endif %}</div>
          <div class="author">{{ link.authors }}</div>
          <div class="periodical"><em>{{ link.conference }}</em></div>
          <div class="links">
            {% if link.code %}<a href="{{ link.code }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Code</a>{% endif %}
            {% if link.page %}<a href="{{ link.page }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Project Page</a>{% endif %}
            {% if link.pdf %}<a href="{{ link.pdf }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">PDF</a>{% endif %}
            {% if link.bibtex %}<a href="{{ link.bibtex }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">BibTex</a>{% endif %}
            {% if link.notes %}<strong><i style="color:#e74d3c">{{ link.notes }}</i></strong>{% endif %}
            {% if link.others %}{{ link.others }}{% endif %}
          </div>
        </div>
      </div>
    </li>
    <br>
    {%- endfor -%}
  </ol>
  {%- endif -%}

</div>
