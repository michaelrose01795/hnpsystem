// file location: src/components/page-ui/parts/parts-manager-ui.js
import LayerSurface from "@/components/ui/LayerSurface"; // canonical layer primitive (CLAUDE.md §3.0)
import LayerTheme from "@/components/ui/LayerTheme"; // canonical layer primitive (CLAUDE.md §3.0)
import Button from "@/components/ui/Button";

const badgeClassForStatus = (status = "") => {
  const normalized = status.toLowerCase();
  if (/stock|fitted|complete|picked|allocated/.test(normalized)) return "app-badge--success";
  if (/wait|order|pending/.test(normalized)) return "app-badge--warning";
  if (/urgent|overdue|failed/.test(normalized)) return "app-badge--danger";
  return "app-badge--neutral";
};

function StaffTable({ children, label }) {
  return (
    <div className="app-table-shell-scroll" role="region" aria-label={label} tabIndex={0}>
      <table className="app-data-table app-data-table--rounded app-table-shell app-table-shell--with-headings">
        {children}
      </table>
    </div>
  );
}

export default function PartsManagerDashboardUi(props) {
  const {
    DeliverySchedulerModal,
    PartsOpsDashboard,
    SkeletonBlock,
    SkeletonKeyframes,
    SkeletonMetricCard,
    closeScheduleModal,
    dashboardData,
    deliveryRoutes,
    error,
    formatCurrency,
    formatDateTime,
    formatMarginValue,
    formatStatusLabel,
    isScheduleModalOpen,
    jobDeliveryMap,
    loadDashboard,
    loading,
    lowStockRows,
    needsDeliveryScheduling,
    openScheduleModalForRow,
    pipelineStages,
    pipelineSummary,
    resolveSourceMeta,
    scheduleModalJob,
    sectionCardStyle,
    teamPerformance,
    techRequests,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
        <div style={{
    padding: "48px",
    textAlign: "center",
    color: "var(--primary-selected)"
  }}>
          Only the parts manager can view this dashboard.
        </div>
      </>; // render extracted page section.

    case "section2":
      return <>
      {loading ? <div role="status" aria-live="polite" aria-label="Loading parts manager dashboard" style={{
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    padding: "8px 0"
  }}>
          <SkeletonKeyframes />
          {/* Title strip — mirrors PartsOpsDashboard's header */}
          <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    }}>
            <SkeletonBlock width="240px" height="22px" />
            <SkeletonBlock width="420px" height="12px" />
          </div>
          {/* Metric cards row */}
          <div style={{
      display: "grid",
      gap: "12px",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))"
    }}>
            {Array.from({
        length: 4
      }).map((_, i) => <SkeletonMetricCard key={i} />)}
          </div>
          {/* Main content grid */}
          <div style={{
      display: "grid",
      gap: "16px",
      gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"
    }}>
            {Array.from({
        length: 2
      }).map((_, i) => <LayerSurface key={i} padding="18px" gap="12px" style={{
        minHeight: "220px"
      }}>
                <SkeletonBlock width="52%" height="16px" />
                <SkeletonBlock width="100%" height="140px" borderRadius="12px" />
                <SkeletonBlock width="68%" height="12px" />
              </LayerSurface>)}
          </div>
        </div> : error ? <div style={{
    padding: "48px",
    textAlign: "center",
    color: "var(--primary-selected)"
  }}>{error}</div> : <div className="app-page-stack">
          <PartsOpsDashboard title="Parts Manager Dashboard" subtitle="Live queue, inbound deliveries and inventory status pulled from Supabase" data={dashboardData} />

          <LayerTheme sectionKey="parts-manager-pipeline" sectionType="content-card" data-dev-text-preview="Parts Pipeline" style={sectionCardStyle}>
            <h2 className="app-staff-card__title">Parts Pipeline</h2>
            <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "12px"
      }}>
              {pipelineStages.map(stage => <LayerSurface key={stage.id} radius="var(--radius-sm)" padding="var(--space-3) var(--space-md)" gap="var(--space-xs)" style={{
          minHeight: "100px"
        }}>
                  <div style={{
            fontSize: "1.2rem",
            fontWeight: 700,
            color: "var(--primary)"
          }}>
                    {stage.count}
                  </div>
                  <div style={{
            fontWeight: 600
          }}>{stage.label}</div>
                  <p style={{
            margin: "6px 0 0 0",
            fontSize: "0.8rem",
            color: "var(--grey-accent-dark)"
          }}>
                    {stage.description}
                  </p>
                </LayerSurface>)}
            </div>
            <div style={{
        marginTop: "12px",
        fontSize: "0.9rem",
        color: "var(--grey-accent-dark)"
      }}>
              {pipelineSummary.totalCount} part line
              {pipelineSummary.totalCount === 1 ? "" : "s"} currently tracked in the pipeline.
            </div>
          </LayerTheme>

          <div className="app-page-stack">
            <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
        gap: "var(--page-stack-gap)"
      }}>
              <LayerTheme sectionKey="parts-manager-queue-snapshot" sectionType="data-table" data-dev-text-preview="Queue Snapshot table" style={sectionCardStyle}>
                <h2 className="app-staff-card__title">Queue Snapshot</h2>
                <StaffTable label="Queue Snapshot">
                  <thead>
                    <tr style={{
                textAlign: "left",
                color: "var(--grey-accent)",
                fontSize: "0.85rem"
              }}>
                      <th style={{
                  paddingBottom: "10px"
                }}>Job</th>
                      <th style={{
                  paddingBottom: "10px"
                }}>Delivery</th>
                      <th style={{
                  paddingBottom: "10px"
                }}>Reg</th>
                      <th style={{
                  paddingBottom: "10px"
                }}>Supplier</th>
                      <th style={{
                  paddingBottom: "10px"
                }}>Status</th>
                      <th style={{
                  paddingBottom: "10px",
                  textAlign: "right"
                }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.workload.map(row => {
                const deliveryInfo = jobDeliveryMap[row.jobId || ""]?.[0] || null;
                const deliveryDate = deliveryInfo?.delivery?.delivery_date;
                const needsSchedule = needsDeliveryScheduling(row.waitingStatus);
                return <tr key={`${row.jobNumber}-${row.advisor}-${row.jobId}`}>
                          <td style={{
                    padding: "12px 0"
                  }}>{row.jobNumber}</td>
                          <td style={{
                    padding: "12px 0"
                  }}>
                            {deliveryInfo ? <div>
                                <div style={{
                        fontWeight: 600
                      }}>Stop {deliveryInfo.stop_number}</div>
                                <div style={{
                        fontSize: "0.8rem",
                        color: "var(--grey-accent-dark)"
                      }}>
                                  {deliveryDate ? new Date(deliveryDate).toLocaleDateString() : "Delivery scheduled"}
                                </div>
                              </div> : <span style={{
                      color: "var(--info)"
                    }}>None</span>}
                            {needsSchedule && <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              className="app-table-action-btn"
                              onClick={() => openScheduleModalForRow(row)}
                              style={{ marginTop: "var(--space-xs)" }}>
                                Schedule Delivery
                              </Button>}
                          </td>
                          <td style={{
                    padding: "12px 0"
                  }}>{row.reg}</td>
                          <td style={{
                    padding: "12px 0"
                  }}>{row.advisor}</td>
                          <td style={{
                    padding: "12px 0"
                  }}><span className={`app-badge ${badgeClassForStatus(row.status)}`}>{row.status}</span></td>
                          <td style={{
                    padding: "12px 0",
                    textAlign: "right",
                    fontWeight: 600
                  }}>{row.value}</td>
                        </tr>;
              })}
                  </tbody>
                </StaffTable>
              </LayerTheme>

              <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--page-stack-gap)"
        }}>
                <LayerTheme sectionKey="parts-manager-status-buckets" sectionType="content-card" data-dev-text-preview="Status Buckets" style={sectionCardStyle}>
                  <h2 className="app-staff-card__title">Status Buckets</h2>
                  {dashboardData.teamAvailability.map(bucket => <div key={bucket.name} style={{
              padding: "var(--space-3) 0",
              borderBottom: "var(--separating-line)"
            }}>
                      <div style={{
                fontWeight: 600
              }}>{bucket.name}</div>
                      <div style={{
                fontSize: "0.85rem",
                color: "var(--grey-accent)"
              }}>{bucket.status}</div>
                      <div style={{
                fontSize: "0.8rem",
                color: "var(--primary-selected)",
                marginTop: "4px"
              }}>{bucket.window}</div>
                    </div>)}
                </LayerTheme>

                <LayerTheme sectionKey="parts-manager-focus-items" sectionType="content-card" data-dev-text-preview="Focus Items" style={sectionCardStyle}>
                  <h2 className="app-staff-card__title">Focus Items</h2>
                  {dashboardData.focusItems.map(item => <div key={item.title} style={{
              padding: "var(--space-3) 0",
              borderBottom: "var(--separating-line)"
            }}>
                      <div style={{
                fontWeight: 600
              }}>{item.title}</div>
                      <div style={{
                color: "var(--grey-accent)",
                fontSize: "0.85rem"
              }}>{item.detail}</div>
                      <div style={{
                fontSize: "0.8rem",
                color: "var(--primary-selected)",
                marginTop: "4px"
              }}>{item.owner}</div>
                    </div>)}
                </LayerTheme>
              </div>
            </div>

            <LayerTheme sectionKey="parts-manager-top-queue-lines" sectionType="data-table" data-dev-text-preview="Top Queue Lines" style={sectionCardStyle}>
              <h2 className="app-staff-card__title">Top Queue Lines</h2>
              <StaffTable label="Top Queue Lines">
                <thead>
                  <tr style={{
              textAlign: "left",
              color: "var(--grey-accent)",
              fontSize: "0.85rem"
            }}>
                    <th style={{
                paddingBottom: "10px"
              }}>Line</th>
                    <th style={{
                paddingBottom: "10px"
              }}>Supplier</th>
                    <th style={{
                paddingBottom: "10px"
              }}>Status</th>
                    <th style={{
                paddingBottom: "10px",
                textAlign: "right"
              }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {teamPerformance.map(row => <tr key={row.name}>
                      <td style={{
                padding: "12px 0"
              }}>{row.name}</td>
                      <td style={{
                padding: "12px 0"
              }}>{row.accuracy}</td>
                      <td style={{
                padding: "12px 0"
              }}><span className={`app-badge ${badgeClassForStatus(row.fillRate)}`}>{row.fillRate}</span></td>
                      <td style={{
                padding: "12px 0",
                textAlign: "right",
                fontWeight: 600
              }}>{row.valuePerDay}</td>
                    </tr>)}
                </tbody>
              </StaffTable>
            </LayerTheme>

            <LayerTheme sectionKey="parts-manager-low-stock" sectionType="data-table" data-dev-text-preview="Low Stock Parts Overview" style={sectionCardStyle}>
              <h2 className="app-staff-card__title">Low Stock Parts Overview</h2>
              {lowStockRows.length === 0 ? <div style={{
          color: "var(--grey-accent)"
        }}>No low stock parts currently.</div> : <StaffTable label="Low Stock Parts Overview">
                  <thead>
                    <tr style={{
              textAlign: "left",
              color: "var(--grey-accent)",
              fontSize: "0.85rem"
            }}>
                      <th style={{
                paddingBottom: "10px"
              }}>Part</th>
                      <th style={{
                paddingBottom: "10px"
              }}>Supplier</th>
                      <th style={{
                paddingBottom: "10px"
              }}>Cost</th>
                      <th style={{
                paddingBottom: "10px"
              }}>Sell</th>
                      <th style={{
                paddingBottom: "10px"
              }}>Margin</th>
                      <th style={{
                paddingBottom: "10px"
              }}>Stock</th>
                      <th style={{
                paddingBottom: "10px"
              }}>Min</th>
                      <th style={{
                paddingBottom: "10px"
              }}>Status</th>
                      <th style={{
                paddingBottom: "10px",
                textAlign: "right"
              }}>Linked Jobs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockRows.map(part => <tr key={part.id}>
                        <td style={{
                padding: "12px 0"
              }}>
                          <div style={{
                  fontWeight: 600
                }}>
                            {part.partNumber} · {part.name}
                          </div>
                        </td>
                        <td style={{
                padding: "12px 0"
              }}>{part.supplier || "—"}</td>
                        <td style={{
                padding: "12px 0"
              }}>{formatCurrency(part.unitCost)}</td>
                        <td style={{
                padding: "12px 0"
              }}>{formatCurrency(part.unitPrice)}</td>
                        <td style={{
                padding: "12px 0"
              }}>{formatMarginValue(part.unitCost, part.unitPrice)}</td>
                        <td style={{
                padding: "12px 0"
              }}>{part.inStock}</td>
                        <td style={{
                padding: "12px 0"
              }}>{part.reorderLevel}</td>
                        <td style={{
                padding: "12px 0"
              }}><span className={`app-badge ${badgeClassForStatus(part.status || "in stock")}`}>
                  {(part.status || "in stock").replace(/_/g, " ")}
                </span></td>
                        <td style={{
                padding: "12px 0",
                textAlign: "right"
              }}>{part.openJobCount || 0}</td>
                      </tr>)}
                  </tbody>
                </StaffTable>}
            </LayerTheme>

          <LayerTheme sectionKey="parts-manager-tech-requests" sectionType="data-table" data-dev-text-preview="Tech Requests" style={sectionCardStyle}>
            <h2 className="app-staff-card__title">Tech Requests</h2>
            {techRequests.length === 0 ? <div style={{
          color: "var(--grey-accent)"
        }}>No open technician requests.</div> : <StaffTable label="Tech Requests">
                  <thead>
                    <tr style={{
              textAlign: "left",
              color: "var(--grey-accent)",
              fontSize: "0.85rem"
            }}>
                      <th style={{
                paddingBottom: "10px"
              }}>Job</th>
                      <th style={{
                paddingBottom: "10px"
              }}>Request</th>
                      <th style={{
                paddingBottom: "10px"
              }}>Qty</th>
                      <th style={{
                paddingBottom: "10px"
              }}>Source</th>
                      <th style={{
                paddingBottom: "10px"
              }}>Status</th>
                      <th style={{
                paddingBottom: "10px"
              }}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {techRequests.map(request => {
              const sourceMeta = resolveSourceMeta(request.source);
              return <tr key={request.request_id}>
                          <td style={{
                  padding: "12px 0"
                }}>{request.job?.job_number || `#${request.job_id}`}</td>
                          <td style={{
                  padding: "12px 0"
                }}>
                            <div style={{
                    fontWeight: 600
                  }}>{request.description || "Part request"}</div>
                            {request.part ? <div style={{
                    fontSize: "0.8rem",
                    color: "var(--info)"
                  }}>
                                {request.part.part_number} · {request.part.name}
                              </div> : null}
                          </td>
                          <td style={{
                  padding: "12px 0"
                }}>{request.quantity || 1}</td>
                          <td style={{
                  padding: "12px 0"
                }}>
                            <span className="app-badge app-badge--accent-soft">{sourceMeta.label}</span>
                          </td>
                          <td style={{
                  padding: "12px 0"
                }}>
                            <span className={`app-badge ${badgeClassForStatus(request.status || "waiting_authorisation")}`}>
                              {formatStatusLabel(request.status || "waiting_authorisation")}
                            </span>
                          </td>
                          <td style={{
                  padding: "12px 0"
                }}>{formatDateTime(request.created_at)}</td>
                        </tr>;
            })}
                  </tbody>
              </StaffTable>}
          </LayerTheme>
        </div>
      </div>}
      <DeliverySchedulerModal open={isScheduleModalOpen} onClose={closeScheduleModal} job={scheduleModalJob} deliveries={deliveryRoutes} onScheduled={() => loadDashboard()} />
  </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
