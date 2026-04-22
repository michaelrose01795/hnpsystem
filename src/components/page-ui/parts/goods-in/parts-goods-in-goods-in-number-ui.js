// file location: src/components/page-ui/parts/goods-in/parts-goods-in-goods-in-number-ui.js

export default function GoodsInDetailPageUi(props) {
  const {
    ScrollArea,
    SkeletonBlock,
    SkeletonKeyframes,
    currencyFormatter,
    error,
    fieldGridStyle,
    goodsIn,
    goodsInNumber,
    invoiceCellStyle,
    invoiceHeaderCellStyle,
    invoiceRowStyle,
    invoiceTableStyles,
    items,
    jobItems,
    labelStyle,
    loading,
    sectionCardStyle,
    stockItems,
    totals,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
        <div style={{
    padding: "32px"
  }}>
          <h1 style={{
      marginBottom: "12px"
    }}>Goods In</h1>
          <p>You do not have permission to access this workspace.</p>
        </div>
      </>; // render extracted page section.

    case "section2":
      return <>
      <div style={{
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    padding: "12px"
  }}>
        <section className="app-section-card" style={sectionCardStyle}>
          <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px"
      }}>
            <div>
              <div style={labelStyle}>Goods In</div>
              <h2 style={{
            margin: "6px 0 0"
          }}>{goodsIn?.goods_in_number || goodsInNumber}</h2>
            </div>
            <div style={{
          textAlign: "right",
          color: "var(--text-secondary)"
        }}>
              <div>{goodsIn?.status ? `Status: ${goodsIn.status}` : "Status: --"}</div>
              <div>{goodsIn?.invoice_date ? `Invoice date: ${goodsIn.invoice_date}` : ""}</div>
            </div>
          </div>
          {loading && <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}>
              <SkeletonKeyframes />
              <SkeletonBlock width="40%" height="16px" />
              <SkeletonBlock width="70%" height="12px" />
              <SkeletonBlock width="60%" height="12px" />
              <SkeletonBlock width="50%" height="12px" />
            </div>}
          {error && <div style={{
        color: "var(--danger)"
      }}>{error}</div>}
          {!loading && !error && goodsIn && <div style={fieldGridStyle}>
              <div>
                <div style={labelStyle}>Supplier</div>
                <div>{goodsIn.supplier_name || "--"}</div>
                <div style={{
            color: "var(--text-secondary)"
          }}>{goodsIn.supplier_address || ""}</div>
                <div style={{
            color: "var(--text-secondary)"
          }}>{goodsIn.supplier_contact || ""}</div>
              </div>
              <div>
                <div style={labelStyle}>Invoice</div>
                <div>{goodsIn.invoice_number || "--"}</div>
                <div style={{
            color: "var(--text-secondary)"
          }}>
                  Delivery note: {goodsIn.delivery_note_number || "--"}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Price Level</div>
                <div>{goodsIn.price_level || "--"}</div>
                <div style={{
            color: "var(--text-secondary)"
          }}>Supplier account: {goodsIn.supplier_account_id || "--"}</div>
              </div>
            </div>}
        </section>

        <section className="app-section-card" style={sectionCardStyle}>
          <h3 style={{
        margin: 0
      }}>Invoice lines</h3>
          {items.length === 0 ? <div style={{
        padding: "24px",
        textAlign: "center",
        color: "var(--text-secondary)"
      }}>
              No invoice lines found.
            </div> : <ScrollArea maxHeight="420px" style={{
        borderRadius: "var(--radius-lg)",
        border: "none",
        overflowX: "hidden",
        background: "var(--layer-section-level-2)"
      }}>
              <table style={invoiceTableStyles}>
                <thead>
                  <tr style={{
              textAlign: "left"
            }}>
                    <th style={invoiceHeaderCellStyle}>Line</th>
                    <th style={invoiceHeaderCellStyle}>Part number</th>
                    <th style={invoiceHeaderCellStyle}>Description</th>
                    <th style={invoiceHeaderCellStyle}>Qty</th>
                    <th style={invoiceHeaderCellStyle}>Cost</th>
                    <th style={invoiceHeaderCellStyle}>Retail</th>
                    <th style={invoiceHeaderCellStyle}>Job</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => <tr key={item.id} style={invoiceRowStyle}>
                      <td style={invoiceCellStyle}>{item.line_number || "--"}</td>
                      <td style={{
                ...invoiceCellStyle,
                fontWeight: 600
              }}>{item.part_number}</td>
                      <td style={{
                ...invoiceCellStyle,
                color: "var(--text-secondary)"
              }}>{item.description}</td>
                      <td style={invoiceCellStyle}>{item.quantity}</td>
                      <td style={invoiceCellStyle}>
                        {item.cost_price ? currencyFormatter.format(item.cost_price) : "--"}
                      </td>
                      <td style={invoiceCellStyle}>
                        {item.retail_price ? currencyFormatter.format(item.retail_price) : "--"}
                      </td>
                      <td style={invoiceCellStyle}>{item.job_number || "Stock"}</td>
                    </tr>)}
                </tbody>
              </table>
            </ScrollArea>}
        </section>

        <section className="app-section-card" style={sectionCardStyle}>
          <h3 style={{
        margin: 0
      }}>Totals</h3>
          <div style={fieldGridStyle}>
            <div>
              <div style={labelStyle}>Total Cost</div>
              <div style={{
            fontSize: "1.2rem",
            fontWeight: 600
          }}>{currencyFormatter.format(totals.cost)}</div>
            </div>
            <div>
              <div style={labelStyle}>Total Retail</div>
              <div style={{
            fontSize: "1.2rem",
            fontWeight: 600
          }}>{currencyFormatter.format(totals.retail)}</div>
            </div>
          </div>
        </section>

        <section className="app-section-card" style={sectionCardStyle}>
          <h3 style={{
        margin: 0
      }}>History</h3>
          <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      }}>
            <div>
              <div style={labelStyle}>Added to job</div>
              {jobItems.length === 0 ? <div style={{
            marginTop: "8px",
            color: "var(--text-secondary)"
          }}>No parts allocated to jobs.</div> : <div style={{
            marginTop: "8px"
          }}>
                  {jobItems.map(item => <div key={item.id} style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 0"
            }}>
                      <div>
                        <strong>{item.part_number}</strong> · {item.description}
                      </div>
                      <div style={{
                color: "var(--text-secondary)"
              }}>
                        Line {item.line_number || "--"} · Qty {item.quantity} · Job {item.job_number || "--"}
                      </div>
                    </div>)}
                </div>}
            </div>
            <div>
              <div style={labelStyle}>Added to stock</div>
              {stockItems.length === 0 ? <div style={{
            marginTop: "8px",
            color: "var(--text-secondary)"
          }}>No parts added to stock.</div> : <div style={{
            marginTop: "8px"
          }}>
                  {stockItems.map(item => <div key={item.id} style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 0"
            }}>
                      <div>
                        <strong>{item.part_number}</strong> · {item.description}
                      </div>
                      <div style={{
                color: "var(--text-secondary)"
              }}>
                        Line {item.line_number || "--"} · Qty {item.quantity}
                      </div>
                    </div>)}
                </div>}
            </div>
          </div>
        </section>
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
