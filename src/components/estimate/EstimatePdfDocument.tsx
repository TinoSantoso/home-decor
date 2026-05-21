/**
 * @react-pdf/renderer component that renders an EstimateDocument as a PDF.
 * Uses Helvetica (built-in font, no external font load needed for Latin + Indonesian).
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { formatIDR } from '../../lib/currency';
import type { EstimateDocument } from '../../lib/pdf-estimate';

interface Props {
  doc: EstimateDocument;
  /** Translations passed from the button/route so this component stays i18n-free internally. */
  labels: {
    title: string;
    generatedAt: string;
    tier: string;
    materials: string;
    labor: string;
    contingency: string;
    tax: string;
    grandTotal: string;
    zoneTotal: string;
    categoryTotal: string;
    assumptions: string;
    assumptionsBody: string;
  };
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 48,
    color: '#1a1a1a',
  },
  // Header
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  headerMeta: {
    fontSize: 9,
    color: '#555555',
  },
  // Section headings
  sectionHeading: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginTop: 18,
    marginBottom: 6,
    color: '#2c2c2c',
  },
  // Assumptions banner
  assumptionsBanner: {
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 4,
    marginBottom: 14,
  },
  assumptionsBannerText: {
    fontSize: 9,
    color: '#444444',
  },
  // Grand total breakdown row
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalLabel: {
    color: '#444444',
  },
  totalValue: {
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    marginTop: 4,
  },
  grandTotalLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  grandTotalValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  // Table
  table: {
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
    paddingBottom: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ececec',
  },
  colName: {
    flex: 2,
  },
  colMeta: {
    flex: 1,
    fontSize: 9,
    color: '#666666',
  },
  colAmount: {
    flex: 1,
    textAlign: 'right',
  },
  colHeaderText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#555555',
  },
  // Assumptions footer
  footer: {
    marginTop: 24,
    borderTopWidth: 0.5,
    borderTopColor: '#d0d0d0',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: '#888888',
  },
});

export function EstimatePdfDocument({ doc, labels }: Props) {
  const { meta, assumptions, totals, zones, categories } = doc;

  const tierPct = Math.round(assumptions.contingencyPct * 100);
  const generatedDate = new Date(meta.generatedAt).toLocaleDateString(
    meta.localeTag,
    { year: 'numeric', month: 'long', day: 'numeric' },
  );

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>{labels.title}</Text>
          <Text style={s.headerMeta}>{meta.projectName}</Text>
          <Text style={s.headerMeta}>
            {labels.generatedAt}: {generatedDate}
          </Text>
        </View>

        {/* Assumptions banner */}
        <View style={s.assumptionsBanner}>
          <Text style={s.assumptionsBannerText}>
            {labels.tier}: {assumptions.tier} · {tierPct}%{' '}
            {labels.contingency.toLowerCase()}
            {assumptions.taxEnabled ? ' · PPN 11%' : ''}
          </Text>
        </View>

        {/* Grand-total breakdown */}
        <Text style={s.sectionHeading}>{labels.grandTotal}</Text>
        <View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>{labels.materials}</Text>
            <Text style={s.totalValue}>
              {formatIDR(totals.materials, meta.localeTag)}
            </Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>{labels.labor}</Text>
            <Text style={s.totalValue}>
              {formatIDR(totals.labor, meta.localeTag)}
            </Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>{labels.contingency}</Text>
            <Text style={s.totalValue}>
              {formatIDR(totals.contingency, meta.localeTag)}
            </Text>
          </View>
          {assumptions.taxEnabled && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>{labels.tax}</Text>
              <Text style={s.totalValue}>
                {formatIDR(totals.tax, meta.localeTag)}
              </Text>
            </View>
          )}
          <View style={s.grandTotalRow}>
            <Text style={s.grandTotalLabel}>{labels.grandTotal}</Text>
            <Text style={s.grandTotalValue}>
              {formatIDR(totals.grandTotal, meta.localeTag)}
            </Text>
          </View>
        </View>

        {/* Per-zone table */}
        {zones.length > 0 && (
          <>
            <Text style={s.sectionHeading}>{labels.zoneTotal}</Text>
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.colName, s.colHeaderText]}>Zona</Text>
                <Text style={[s.colMeta, s.colHeaderText]}>Tipe / m²</Text>
                <Text style={[s.colAmount, s.colHeaderText]}>Total</Text>
              </View>
              {zones.map((zone, idx) => (
                <View key={idx} style={s.tableRow}>
                  <Text style={s.colName}>{zone.name}</Text>
                  <Text style={s.colMeta}>
                    {zone.typeLabel} · {zone.areaM2.toFixed(1)} m²
                  </Text>
                  <Text style={s.colAmount}>
                    {formatIDR(zone.total, meta.localeTag)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Per-category table */}
        {categories.length > 0 && (
          <>
            <Text style={s.sectionHeading}>{labels.categoryTotal}</Text>
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.colName, s.colHeaderText]}>Kategori</Text>
                <Text style={[s.colMeta, s.colHeaderText]}>
                  {labels.materials} / {labels.labor}
                </Text>
                <Text style={[s.colAmount, s.colHeaderText]}>Total</Text>
              </View>
              {categories.map((cat, idx) => (
                <View key={idx} style={s.tableRow}>
                  <Text style={s.colName}>{cat.label}</Text>
                  <Text style={s.colMeta}>
                    {formatIDR(cat.materials, meta.localeTag)} /{' '}
                    {formatIDR(cat.labor, meta.localeTag)}
                  </Text>
                  <Text style={s.colAmount}>
                    {formatIDR(cat.total, meta.localeTag)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Assumptions footer */}
        <View style={s.footer}>
          <Text style={[s.footerText, { fontFamily: 'Helvetica-Bold', marginBottom: 3 }]}>
            {labels.assumptions}
          </Text>
          <Text style={s.footerText}>{labels.assumptionsBody}</Text>
        </View>
      </Page>
    </Document>
  );
}
