import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import {
  decodeHtmlEntities,
  cleanHtmlWrapper,
  extractBilingualContent,
  sanitizeHtml
} from '../shared/lib/htmlSanitizer';
import { getLocalizedField, pickDefaultLanguage } from '../shared/lib/language';
import { mapQuestionToFrontend } from '../shared/types/index';
import MathRenderer from '../shared/components/MathRenderer';

describe('Question and Option HTML / Entity Decoding and Sanitization', () => {
  describe('decodeHtmlEntities', () => {
    it('decodes escaped HTML tag entities (&lt;p&gt; -> <p>)', () => {
      const input = '&lt;p&gt;In the following question, select the related word.&lt;/p&gt;';
      expect(decodeHtmlEntities(input)).toBe('<p>In the following question, select the related word.</p>');
    });

    it('decodes numeric Unicode entities (e.g. Hindi Devanagari &#2344; -> न)', () => {
      const input = '&#2344;&#2367;&#2350;&#2381;&#2344;';
      expect(decodeHtmlEntities(input)).toBe('निम्न');
    });

    it('decodes standard named entities (&amp;, &quot;, &#39;, &nbsp;)', () => {
      const input = 'Watt &amp; Power &quot;Test&#39;s&nbsp;Score&quot;';
      expect(decodeHtmlEntities(input)).toBe('Watt & Power "Test\'s Score"');
    });

    it('handles null, undefined, and non-string values safely', () => {
      expect(decodeHtmlEntities(null)).toBe('');
      expect(decodeHtmlEntities(undefined)).toBe('');
      expect(decodeHtmlEntities('')).toBe('');
      expect(decodeHtmlEntities('plain text')).toBe('plain text');
    });
  });

  describe('cleanHtmlWrapper', () => {
    it('unwraps single outer <p>...</p> tags', () => {
      expect(cleanHtmlWrapper('<p>Pressure</p>')).toBe('Pressure');
      expect(cleanHtmlWrapper('<p class="opt">Energy</p>')).toBe('Energy');
    });

    it('preserves multi-paragraph HTML structures', () => {
      const multi = '<p>Paragraph 1</p><p>Paragraph 2</p>';
      expect(cleanHtmlWrapper(multi)).toBe(multi);
    });

    it('handles nested inline tags within single paragraph', () => {
      expect(cleanHtmlWrapper('<p><b>Option A:</b> 12 m/s</p>')).toBe('<b>Option A:</b> 12 m/s');
    });
  });

  describe('extractBilingualContent', () => {
    it('extracts English and Hindi spans from eqt/hqt bilingual markup', () => {
      const input =
        '<span class="eqt"><p>Watt: Power :: Pascal: ?</p></span>' +
        '<span class="hqt" style="display:none"><p>&#2357;&#2366;&#2335;: &#2358;&#2325;&#2381;&#2340;&#2367; :: &#2346;&#2366;&#2360;&#2381;&#2325;&#2354;: ?</p></span>';

      const result = extractBilingualContent(input);
      expect(result.en).toBe('Watt: Power :: Pascal: ?');
      expect(result.hi).toBe('वाट: शक्ति :: पास्कल: ?');
    });

    it('extracts simple single-line options without spans cleanly', () => {
      const input = '<span class="eqt">Energy</span><span class="hqt" style="display:none">&#2314;&#2352;&#2381;&#2332;&#2366;</span>';
      const result = extractBilingualContent(input);
      expect(result.en).toBe('Energy');
      expect(result.hi).toBe('ऊर्जा');
    });

    it('returns original decoded text as en when no bilingual spans exist', () => {
      const input = '<p>Regular question text</p>';
      const result = extractBilingualContent(input);
      expect(result.en).toBe('Regular question text');
      expect(result.hi).toBe('');
    });
  });

  describe('getLocalizedField', () => {
    it('resolves English from bilingual string when lang is en', () => {
      const input = '<span class="eqt">Force</span><span class="hqt">&#2348;&#2354;</span>';
      expect(getLocalizedField(input, 'en')).toBe('Force');
    });

    it('resolves Hindi from bilingual string when lang is hi', () => {
      const input = '<span class="eqt">Force</span><span class="hqt">&#2348;&#2354;</span>';
      expect(getLocalizedField(input, 'hi')).toBe('बल');
    });

    it('maps an array of bilingual options correctly for both languages', () => {
      const options = [
        '<span class="eqt">Energy</span><span class="hqt">&#2314;&#2352;&#2381;&#2332;&#2366;</span>',
        '<span class="eqt">Temperature</span><span class="hqt">&#2340;&#2366;&#2346;&#2350;&#2366;&#2344;</span>',
        '<span class="eqt">Pressure</span><span class="hqt">&#2342;&#2348;&#2366;&#2357;</span>',
        '<span class="eqt">Force</span><span class="hqt">&#2348;&#2354;</span>'
      ];

      const enOpts = getLocalizedField(options, 'en');
      expect(enOpts).toEqual(['Energy', 'Temperature', 'Pressure', 'Force']);

      const hiOpts = getLocalizedField(options, 'hi');
      expect(hiOpts).toEqual(['ऊर्जा', 'तापमान', 'दबाव', 'बल']);
    });

    it('unwraps single <p> tags from { en, hi } object properties', () => {
      const field = {
        en: '<p>Option Alpha</p>',
        hi: '<p>विकल्प अल्फा</p>'
      };
      expect(getLocalizedField(field, 'en')).toBe('Option Alpha');
      expect(getLocalizedField(field, 'hi')).toBe('विकल्प अल्फा');
    });

    it('falls back to English options when Hindi options array is empty', () => {
      const options = {
        en: ['<p>Weber</p>', '<p>Pascal</p>', '<p>Farad</p>', '<p>Henry</p>'],
        hi: []
      };
      const result = getLocalizedField(options, 'hi');
      expect(result).toEqual(['Weber', 'Pascal', 'Farad', 'Henry']);
    });
  });

  describe('mapQuestionToFrontend', () => {
    it('normalizes a backend question with raw eqt/hqt spans into clean en/hi objects', () => {
      const backendQuestion = {
        id: '101',
        question: '<span class="eqt"><p>Select the related word.</p><p>Watt: Power :: Pascal: ?</p></span><span class="hqt" style="display:none"><p>&#2357;&#2366;&#2335;: &#2358;&#2325;&#2381;&#2340;&#2367;</p></span>',
        options: [
          '<span class="eqt">Energy</span><span class="hqt" style="display:none">&#2314;&#2352;&#2381;&#2332;&#2366;</span>',
          '<span class="eqt">Pressure</span><span class="hqt" style="display:none">&#2342;&#2348;&#2366;&#2357;</span>'
        ],
        solution: '<p>Watt is SI unit of Power.</p>',
        correct_option: 1,
        marks: 2,
        negative_marks: 0.5
      };

      const mapped = mapQuestionToFrontend(backendQuestion);
      expect(mapped.id).toBe('101');
      expect(mapped.text.en).toBe('<p>Select the related word.</p><p>Watt: Power :: Pascal: ?</p>');
      expect(mapped.text.hi).toBe('वाट: शक्ति');
      expect(mapped.options.en).toEqual(['Energy', 'Pressure']);
      expect(mapped.options.hi).toEqual(['ऊर्जा', 'दबाव']);
      expect(mapped.explanation.en).toBe('Watt is SI unit of Power.');
      expect(mapped.correct).toBe(1);
      expect(mapped.correctOption).toBe(1);
      expect(mapped.correctAnswer).toBe(1);
      expect(mapped.correct_option).toBe(1);
    });

    it('correctly maps 0-indexed integer correct_option for Option A (0), Option B (1), Option C (2), Option D (3)', () => {
      const qA = mapQuestionToFrontend({ id: '1', question: 'Q1', options: ['A', 'B', 'C', 'D'], correct_option: 0 });
      const qB = mapQuestionToFrontend({ id: '2', question: 'Q2', options: ['A', 'B', 'C', 'D'], correct_option: 1 });
      const qC = mapQuestionToFrontend({ id: '3', question: 'Q3', options: ['A', 'B', 'C', 'D'], correct_option: 2 });
      const qD = mapQuestionToFrontend({ id: '4', question: 'Q4', options: ['A', 'B', 'C', 'D'], correct_option: 3 });

      expect(qA.correctOption).toBe(0);
      expect(qB.correctOption).toBe(1);
      expect(qC.correctOption).toBe(2);
      expect(qD.correctOption).toBe(3);
    });

    it('prioritizes correct_option over legacy correct_answer: 0', () => {
      const q = mapQuestionToFrontend({
        id: '36932',
        question: 'Which of the following is related to the study of fungi?',
        options: ['Ornithology', 'mycology', 'Reptilian', 'Fisheries'],
        correct_option: 1, // Option B (mycology)
        correct_answer: 0, // Legacy fallback column
      });

      expect(q.correctOption).toBe(1);
      expect(q.correct).toBe(1);
      expect(q.correctAnswer).toBe(1);
    });
  });

  describe('MathRenderer Component', () => {
    it('does not compile <p>16</p> into KaTeX math operators', async () => {
      const { container } = render(<MathRenderer text="<p>16</p>" />);
      await waitFor(() => {
        expect(container.textContent.trim()).toBe('16');
      });
      expect(container.querySelector('.math-renderer-content')).toBeTruthy();
      expect(container.textContent).not.toContain('<p>');
      expect(container.textContent).not.toContain('</p>');
    });

    it('decodes escaped HTML entities properly (&lt;p&gt; -> paragraph instead of literal tag text)', async () => {
      const { container } = render(<MathRenderer text="&lt;p&gt;Clean Question Stem&lt;/p&gt;" />);
      await waitFor(() => {
        expect(container.textContent).toContain('Clean Question Stem');
      });
      expect(container.textContent).not.toContain('&lt;p&gt;');
      expect(container.textContent).not.toContain('<p>');
    });
  });

});
