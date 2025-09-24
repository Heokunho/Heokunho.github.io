<h2 id="publications" style="margin: 2px 0px -15px;">Publications</h2>

{% assign all = site.data.publications.main %}

{%- comment -%}
자동 분류 규칙
- papers: pdf 존재
- projects: page 존재 && pdf 없음
- codes: code 존재 && pdf 없음 && page 없음
- others: 위 어디에도 해당 안 되는 항목
{%- endcomment -%}

{% assign papers   = all | where_exp: "i", "i.pdf" %}
{% assign projects = all | where_exp: "i", "i.page and i.pdf == nil" %}
{% assign codes    = all | where_exp: "i", "i.code and i.pdf == nil and i.page == nil" %}

{%- assign union_ppc = papers | concat: projects | concat: codes -%}
{%- assign others = all | where_exp: "i", "union_ppc contains i | not" -%}

<div class="publications">

  {%- if papers and papers.size > 0 -%}
  <h3 style="margin-top:18px;">Papers</h3>
  <ol class="bibliography">
    {%- for link in papers -%}
      <li>
        <div class="pub-row">
          <div class="col-sm-3 abbr" style="position: relative;padding-right: 15px;padding-left: 15px;">
            {%- if link.image -%}
              <img src="{{ link.image }}" class="teaser img-fluid z-depth-1" style="width=100;height=40%">
              {%- if link.conference_short -%}
                <abbr class="badge">{{ link.conference_short }}</abbr>
              {%- endif -%}
            {%- endif -%}
          </div>
          <div class="col-sm-9" style="position: relative;padding-right: 15px;padding-left: 20px;">
            <div class="title">
              {%- if link.pdf -%}<a href="{{ link.pdf }}">{%- endif -%}
              {{ link.title }}
              {%- if link.pdf -%}</a>{%- endif -%}
            </div>
            <div class="author">{{ link.authors }}</div>
            <div class="periodical"><em>{{ link.conference }}</em></div>
            <div class="links">
              {%- if link.pdf -%}<a href="{{ link.pdf }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">PDF</a>{%- endif -%}
              {%- if link.code -%}<a href="{{ link.code }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Code</a>{%- endif -%}
              {%- if link.page -%}<a href="{{ link.page }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Project Page</a>{%- endif -%}
              {%- if link.bibtex -%}<a href="{{ link.bibtex }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">BibTex</a>{%- endif -%}
              {%- if link.notes -%}<strong><i style="color:#e74d3c">{{ link.notes }}</i></strong>{%- endif -%}
              {%- if link.others -%}{{ link.others }}{%- endif -%}
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
            {%- if link.image -%}
              <img src="{{ link.image }}" class="teaser img-fluid z-depth-1" style="width=100;height=40%">
            {%- endif -%}
          </div>
          <div class="col-sm-9" style="position: relative;padding-right: 15px;padding-left: 20px;">
            <div class="title">
              {%- if link.page -%}<a href="{{ link.page }}">{%- endif -%}
              {{ link.title }}
              {%- if link.page -%}</a>{%- endif -%}
            </div>
            <div class="author">{{ link.authors }}</div>
            <div class="periodical"><em>{{ link.conference }}</em></div>
            <div class="links">
              {%- if link.page -%}<a href="{{ link.page }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Project Page</a>{%- endif -%}
              {%- if link.code -%}<a href="{{ link.code }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Code</a>{%- endif -%}
              {%- if link.pdf -%}<a href="{{ link.pdf }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">PDF</a>{%- endif -%}
              {%- if link.bibtex -%}<a href="{{ link.bibtex }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">BibTex</a>{%- endif -%}
              {%- if link.notes -%}<strong><i style="color:#e74d3c">{{ link.notes }}</i></strong>{%- endif -%}
              {%- if link.others -%}{{ link.others }}{%- endif -%}
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
            {%- if link.image -%}
              <img src="{{ link.image }}" class="teaser img-fluid z-depth-1" style="width=100;height=40%">
            {%- endif -%}
          </div>
          <div class="col-sm-9" style="position: relative;padding-right: 15px;padding-left: 20px;">
            <div class="title">
              {%- if link.code -%}<a href="{{ link.code }}">{%- endif -%}
              {{ link.title }}
              {%- if link.code -%}</a>{%- endif -%}
            </div>
            <div class="author">{{ link.authors }}</div>
            <div class="periodical"><em>{{ link.conference }}</em></div>
            <div class="links">
              {%- if link.code -%}<a href="{{ link.code }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Code</a>{%- endif -%}
              {%- if link.page -%}<a href="{{ link.page }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Project Page</a>{%- endif -%}
              {%- if link.pdf -%}<a href="{{ link.pdf }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">PDF</a>{%- endif -%}
              {%- if link.bibtex -%}<a href="{{ link.bibtex }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">BibTex</a>{%- endif -%}
              {%- if link.notes -%}<strong><i style="color:#e74d3c">{{ link.notes }}</i></strong>{%- endif -%}
              {%- if link.others -%}{{ link.others }}{%- endif -%}
            </div>
          </div>
        </div>
      </li>
      <br>
    {%- endfor -%}
  </ol>
  {%- endif -%}

  {%- if others and others.size > 0 -%}
  <h3 style="margin-top:18px;">Others</h3>
  <ol class="bibliography">
    {%- for link in others -%}
      <li>
        <div class="pub-row">
          <div class="col-sm-3 abbr" style="position: relative;padding-right: 15px;padding-left: 15px;">
            {%- if link.image -%}
              <img src="{{ link.image }}" class="teaser img-fluid z-depth-1" style="width=100;height=40%">
            {%- endif -%}
          </div>
          <div class="col-sm-9" style="position: relative;padding-right: 15px;padding-left: 20px;">
            <div class="title">{{ link.title }}</div>
            <div class="author">{{ link.authors }}</div>
            <div class="periodical"><em>{{ link.conference }}</em></div>
            <div class="links">
              {%- if link.pdf -%}<a href="{{ link.pdf }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">PDF</a>{%- endif -%}
              {%- if link.code -%}<a href="{{ link.code }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Code</a>{%- endif -%}
              {%- if link.page -%}<a href="{{ link.page }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">Project Page</a>{%- endif -%}
              {%- if link.bibtex -%}<a href="{{ link.bibtex }}" class="btn btn-sm z-depth-0" target="_blank" style="font-size:12px;">BibTex</a>{%- endif -%}
              {%- if link.notes -%}<strong><i style="color:#e74d3c">{{ link.notes }}</i></strong>{%- endif -%}
              {%- if link.others -%}{{ link.others }}{%- endif -%}
            </div>
          </div>
        </div>
      </li>
      <br>
    {%- endfor -%}
  </ol>
  {%- endif -%}

</div>
