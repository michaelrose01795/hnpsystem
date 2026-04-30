// file location: src/components/page-ui/parts/parts-manager-ui.js

export default function PartsManagerDashboardUi(props) {
  const {
    DeliverySchedulerModal,
    PartsOpsDashboard,
    SkeletonBlock,
    SkeletonKeyframes,
    SkeletonMetricCard,
    SourceBadge,
    closeScheduleModal,
    containerStyle,
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
    performanceTableStyle,
    pipelineStages,
    pipelineSummary,
    resolveSourceMeta,
    resolveStatusStyles,
    scheduleModalJob,
    sectionCardStyle,
    sectionTitleStyle,
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
      }).map((_, i) => <div key={i} style={{
        background: "var(--surface)",
        border: "1px solid var(--accent-base)",
        borderRadius: "var(--radius-md)",
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        minHeight: "220px"
      }}>
                <SkeletonBlock width="52%" height="16px" />
                <SkeletonBlock width="100%" height="140px" borderRadius="12px" />
                <SkeletonBlock width="68%" height="12px" />
              </div>)}
          </div>
        </div> : error ? <div style={{
    padding: "48px",
    textAlign: "center",
    color: "var(--primary-selected)"
  }}>{error}</div> : <>
          <PartsOpsDashboard title="Parts Manager Dashboard" subtitle="Live queue, inbound deliveries and inventory status pulled from Supabase" data={dashboardData} />

          <div className="app-section-card" style={sectionCardStyle}>
            <div style={sectionTitleStyle}>Parts Pipeline</div>
            <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "12px"
      }}>
              {pipelineStages.map(stage => <div key={stage.id} style={{
          padding: "10px 12px",
          borderRadius: "var(--radius-sm)",
          border: "none",
          background: "rgba(var(--danger-rgb), 0.4)",
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
                </div>)}
            </div>
            <div style={{
        marginTop: "12px",
        fontSize: "0.9rem",
        color: "var(--grey-accent-dark)"
      }}>
              {pipelineSummary.totalCount} part line
              {pipelineSummary.totalCount === 1 ? "" : "s"} currently tracked in the pipeline.
            </div>
          </div>

          <div style={containerStyle}>
            <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)",
        gap: "20px"
      }}>
              <div className="app-section-card" style={sectionCardStyle}>
                <div style={sectionTitleStyle}>Queue Snapshot</div>
                <table style={performanceTableStyle}>
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
                return <tr key={`${row.jobNumber}-${row.advisor}-${row.jobId}`} style={{
                  borderTop: "1px solid rgba(var(--shadow-rgb),0.06)"
                }}>
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
                            {needsSchedule && <button type="button" onClick={() => openScheduleModalForRow(row)} style={{
                      marginTop: "6px",
                      borderRadius: "var(--radius-xs)",
                      border: "1px solid var(--accent-purple)",
                      background: "var(--surface)",
                      color: "var(--accent-purple)",
                      padding: "4px 10px",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontSize: "0.75rem"
                    }}>
                                Schedule Delivery
                              </button>}
                          </td>
                          <td style={{
                    padding: "12px 0"
                  }}>{row.reg}</td>
                          <td style={{
                    padding: "12px 0"
                  }}>{row.advisor}</td>
                          <td style={{
                    padding: "12px 0"
                  }}>{row.status}</td>
                          <td style={{
                    padding: "12px 0",
                    textAlign: "right",
                    fontWeight: 600
                  }}>{row.value}</td>
                        </tr>;
              })}
                  </tbody>
                </table>
              </div>

              <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px"
        }}>
                <div className="app-section-card" style={sectionCardStyle}>
                  <div style={sectionTitleStyle}>Status Buckets</div>
                  {dashboardData.teamAvailability.map(bucket => <div key={bucket.name} style={{
              padding: "10px 0",
              borderBottom: "1px solid rgba(var(--shadow-rgb),0.06)"
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
                </div>

                <div className="app-section-card" style={sectionCardStyle}>
                  <div style={sectionTitleStyle}>Focus Items</div>
                  {dashboardData.focusItems.map(item => <div key={item.title} style={{
              padding: "10px 0",
              borderBottom: "1px solid rgba(var(--shadow-rgb),0.06)"
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
                </div>
              </div>
            </div>

            <div className="app-section-card" style={sectionCardStyle}>
              <div style={sectionTitleStyle}>Top Queue Lines</div>
              <table style={performanceTableStyle}>
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
                  {teamPerformance.map(row => <tr key={row.name} style={{
              borderTop: "1px solid rgba(var(--shadow-rgb),0.06)"
            }}>
                      <td style={{
                padding: "12px 0"
              }}>{row.name}</td>
                      <td style={{
                padding: "12px 0"
              }}>{row.accuracy}</td>
                      <td style={{
                padding: "12px 0"
              }}>{row.fillRate}</td>
                      <td style={{
                padding: "12px 0",
                textAlign: "right",
                fontWeight: 600
              }}>{row.valuePerDay}</td>
                    </tr>)}
                </tbody>
              </table>
            </div>

            <div className="app-section-card" style={sectionCardStyle}>
              <div style={sectionTitleStyle}>Low Stock Parts Overview</div>
              {lowStockRows.length === 0 ? <div style={{
          color: "var(--grey-accent)"
        }}>No low stock parts currently.</div> : <table style={performanceTableStyle}>
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
                    {lowStockRows.map(part => <tr key={part.id} style={{
              borderTop: "1px solid rgba(var(--shadow-rgb),0.06)"
            }}>
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
              }}>{(part.status || "in stock").replace(/_/g, " ")}</td>
                        <td style={{
                padding: "12px 0",
                textAlign: "right"
              }}>{part.openJobCount || 0}</td>
                      </tr>)}
                  </tbody>
                </table>}
            </div>

          <div className="app-section-card" style={sectionCardStyle}>
            <div style={sectionTitleStyle}>Tech Requests</div>
            {techRequests.length === 0 ? <div style={{
          color: "var(--grey-accent)"
        }}>No open technician requests.</div> : <table style={performanceTableStyle}>
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
              const statusMeta = resolveStatusStyles(request.status || "waiting_authorisation");
              return <tr key={request.request_id} style={{
                borderTop: "1px solid rgba(var(--shadow-rgb),0.06)"
              }}>
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
                            <SourceBadge label={sourceMeta.label} background={sourceMeta.background} color={sourceMeta.color} />
                          </td>
                          <td style={{
                  padding: "12px 0"
                }}>
                            <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 10px",
                    borderRadius: "var(--radius-pill)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    background: statusMeta.background,
                    color: statusMeta.color
                  }}>
                              {formatStatusLabel(request.status || "waiting_authorisation")}
                            </span>
                          </td>
                          <td style={{
                  padding: "12px 0"
                }}>{formatDateTime(request.created_at)}</td>
                        </tr>;
            })}
                  </tbody>
              </table>}
          </div>
        </div>
      </>}
      <DeliverySchedulerModal open={isScheduleModalOpen} onClose={closeScheduleModal} job={scheduleModalJob} deliveries={deliveryRoutes} onScheduled={() => loadDashboard()} />
  </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
