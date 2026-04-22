// file location: src/components/page-ui/parts/deliveries/parts-deliveries-delivery-id-ui.js

export default function DeliveryRoutePageUi(props) {
  const {
    InlineLoading,
    Link,
    ModalPortal,
    STATUS_META,
    SkeletonBlock,
    SkeletonKeyframes,
    actionLoading,
    activeStop,
    addressInput,
    buttonStyle,
    cancelNoteEditing,
    customerQuery,
    customerResults,
    customerSearchLoading,
    delivery,
    deliveryId,
    dieselPricePerLitre,
    draggedStopId,
    driverLabel,
    dropTargetId,
    error,
    formatCurrency,
    handleAddStopClick,
    handleCloseModal,
    handleCompleteRoute,
    handleConfirmDelivery,
    handleDeleteStop,
    handleDragEnd,
    handleDragOver,
    handleDragStart,
    handleDrop,
    handleMarkDelivered,
    handleSaveMpg,
    handleSaveNote,
    handleSaveStop,
    handleSelectCustomer,
    handleStartRoute,
    handleStatusUpdate,
    jobNumberInput,
    loading,
    modalError,
    modalOpen,
    mpgDraft,
    nextPlannedStop,
    noteDraft,
    noteEditingId,
    noteSaving,
    orderedStops,
    postcodeInput,
    savingStop,
    setAddressInput,
    setCustomerQuery,
    setJobNumberInput,
    setMpgDraft,
    setNoteDraft,
    setPostcodeInput,
    startNoteEditing,
    stopCardStyle,
    stopsCount,
    totalFuelCost,
    totalMileage,
    vehicleLabel,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
        <div style={{
    padding: "48px",
    textAlign: "center",
    color: "var(--primary-dark)"
  }}>
          You do not have access to delivery planning.
        </div>
      </>; // render extracted page section.

    case "section2":
      return <>
      <div style={{
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "22px"
  }}>
        <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px"
    }}>
          <Link href="/parts/deliveries" style={{
        color: "var(--primary-dark)",
        fontWeight: 600
      }}>
            ← Back to deliveries
          </Link>
          <p style={{
        margin: 0,
        color: "var(--info)"
      }}>
            Delivery ID: {delivery?.id || deliveryId || "—"}
          </p>
        </div>

        <section style={{
      borderRadius: "var(--radius-lg)",
      border: "none",
      background: "var(--surface)",
      padding: "22px",
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    }}>
          <p style={{
        margin: 0,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--primary-dark)"
      }}>
            Route overview
          </p>
          <h1 style={{
        margin: "4px 0 0",
        color: "var(--primary)"
      }}>Stops & delivery details</h1>
          <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "16px"
      }}>
            <div>
              <p style={{
            margin: 0,
            fontSize: "0.85rem",
            color: "var(--info)"
          }}>Driver</p>
              <p style={{
            margin: "4px 0 0",
            fontWeight: 600
          }}>{driverLabel}</p>
            </div>
            <div>
              <p style={{
            margin: 0,
            fontSize: "0.85rem",
            color: "var(--info)"
          }}>Vehicle</p>
              <p style={{
            margin: "4px 0 0",
            fontWeight: 600
          }}>{vehicleLabel}</p>
            </div>
            <div>
              <p style={{
            margin: 0,
            fontSize: "0.85rem",
            color: "var(--info)"
          }}>Fuel type</p>
              <p style={{
            margin: "4px 0 0",
            fontWeight: 600
          }}>
                {delivery?.fuel_type || "Not specified"}
              </p>
            </div>
            <div>
              <p style={{
            margin: 0,
            fontSize: "0.85rem",
            color: "var(--info)"
          }}>Diesel price</p>
              <p style={{
            margin: "4px 0 0",
            fontWeight: 600
          }}>
                {formatCurrency(dieselPricePerLitre)} / L
              </p>
            </div>
            <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px"
        }}>
              <p style={{
            margin: 0,
            fontSize: "0.85rem",
            color: "var(--info)"
          }}>Vehicle MPG</p>
              <div style={{
            display: "flex",
            gap: "8px",
            alignItems: "center"
          }}>
                <input type="number" min="1" step="0.1" value={mpgDraft} onChange={event => setMpgDraft(event.target.value)} placeholder="e.g. 28" style={{
              borderRadius: "var(--radius-sm)",
              border: "none",
              padding: "8px 10px",
              width: "100px"
            }} />
                <button type="button" onClick={handleSaveMpg} disabled={actionLoading} style={{
              ...buttonStyle,
              background: "var(--info-dark)",
              color: "var(--surface)",
              padding: "8px 12px",
              minWidth: "80px",
              opacity: actionLoading ? 0.6 : 1
            }}>
                  Save
                </button>
              </div>
            </div>
            <div>
              <p style={{
            margin: 0,
            fontSize: "0.85rem",
            color: "var(--info)"
          }}>Stops planned</p>
              <p style={{
            margin: "4px 0 0",
            fontWeight: 600
          }}>{stopsCount}</p>
            </div>
            <div>
              <p style={{
            margin: 0,
            fontSize: "0.85rem",
            color: "var(--info)"
          }}>Total mileage</p>
              <p style={{
            margin: "4px 0 0",
            fontWeight: 600
          }}>
                {totalMileage.toLocaleString()} km
              </p>
            </div>
            <div>
              <p style={{
            margin: 0,
            fontSize: "0.85rem",
            color: "var(--info)"
          }}>Fuel estimate</p>
              <p style={{
            margin: "4px 0 0",
            fontWeight: 600
          }}>
                {formatCurrency(totalFuelCost)}
              </p>
            </div>
          </div>
        </section>

        <div style={{
      display: "flex",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: "12px",
      alignItems: "center"
    }}>
          <button type="button" onClick={handleAddStopClick} style={{
        ...buttonStyle,
        background: "var(--primary)",
        color: "var(--surface)",
        border: "1px solid var(--primary)"
      }}>
            Add Stop
          </button>
          <span style={{
        color: "var(--info)",
        fontSize: "0.85rem"
      }}>
            Drag stops to reorder and keep mileage accurate.
          </span>
        </div>

        {modalOpen && <ModalPortal>
            <div style={{
        position: "fixed",
        inset: 0,
        background: "rgba(var(--accent-purple-rgb), 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 40,
        padding: "24px"
      }}>
              <div style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-md)",
          width: "min(540px, 100%)",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
              <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px"
          }}>
                <h2 style={{
              margin: 0,
              color: "var(--primary)",
              fontSize: "1.3rem"
            }}>Add stop</h2>
                <button type="button" onClick={handleCloseModal} style={{
              border: "none",
              background: "transparent",
              color: "var(--info)",
              cursor: "pointer",
              fontWeight: 600
            }}>
                  Close
                </button>
              </div>
              <label style={{
            fontWeight: 600,
            color: "var(--info)"
          }}>Search customer</label>
              <input type="text" placeholder="Type name or company" value={customerQuery} onChange={event => setCustomerQuery(event.target.value)} style={{
            borderRadius: "var(--radius-sm)",
            border: "none",
            padding: "10px 12px"
          }} />
              {customerSearchLoading && <InlineLoading width={120} label="Searching" />}
              {customerResults.length > 0 && <ul style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}>
                  {customerResults.map(customer => {
              const label = customer.name || [customer.firstname, customer.lastname].filter(Boolean).join(" ").trim() || "Customer";
              return <li key={customer.id}>
                        <button type="button" onClick={() => handleSelectCustomer(customer)} style={{
                  width: "100%",
                  textAlign: "left",
                  background: "var(--danger-surface)",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 12px",
                  cursor: "pointer",
                  fontWeight: 600,
                  color: "var(--primary-dark)"
                }}>
                          {label}
                          <span style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 400,
                    color: "var(--info)"
                  }}>
                            {customer.address || "Address not stored"}
                          </span>
                        </button>
                      </li>;
            })}
                </ul>}
              <label style={{
            fontWeight: 600,
            color: "var(--info)"
          }}>Job number (optional)</label>
              <input type="text" value={jobNumberInput} onChange={event => setJobNumberInput(event.target.value)} placeholder="e.g. 00001" style={{
            borderRadius: "var(--radius-sm)",
            border: "none",
            padding: "10px 12px"
          }} />
              <label style={{
            fontWeight: 600,
            color: "var(--info)"
          }}>Address</label>
              <textarea rows={3} value={addressInput} onChange={event => setAddressInput(event.target.value)} placeholder="Customer address…" style={{
            borderRadius: "var(--radius-sm)",
            border: "none",
            padding: "10px 12px",
            resize: "vertical"
          }} />
              <label style={{
            fontWeight: 600,
            color: "var(--info)"
          }}>Postcode</label>
              <input type="text" value={postcodeInput} onChange={event => setPostcodeInput(event.target.value)} placeholder="Postcode" style={{
            borderRadius: "var(--radius-sm)",
            border: "none",
            padding: "10px 12px"
          }} />
              {modalError && <p style={{
            color: "var(--danger)",
            margin: 0
          }}>{modalError}</p>}
              <div style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            flexWrap: "wrap"
          }}>
                <button type="button" onClick={handleCloseModal} style={{
              ...buttonStyle,
              background: "var(--surface)",
              border: "none",
              color: "var(--primary-dark)"
            }}>
                  Cancel
                </button>
                <button type="button" onClick={handleSaveStop} disabled={savingStop} style={{
              ...buttonStyle,
              background: "var(--info-dark)",
              color: "var(--surface)",
              opacity: savingStop ? 0.6 : 1
            }}>
                  {savingStop ? "Saving…" : "Save stop"}
                </button>
              </div>
              </div>
            </div>
          </ModalPortal>}

        <section style={{
      display: "flex",
      flexDirection: "column",
      gap: "14px"
    }}>
          <div style={{
        display: "flex",
        gap: "12px",
        flexWrap: "wrap"
      }}>
            <button type="button" onClick={handleStartRoute} disabled={actionLoading || !nextPlannedStop} style={{
          ...buttonStyle,
          background: "var(--surface)",
          border: "none",
          color: "var(--primary-dark)",
          opacity: actionLoading || !nextPlannedStop ? 0.6 : 1
        }}>
              Start Route
            </button>
            <button type="button" onClick={handleMarkDelivered} disabled={actionLoading || !activeStop && !nextPlannedStop} style={{
          ...buttonStyle,
          background: "var(--primary)",
          color: "var(--surface)",
          opacity: actionLoading || !activeStop && !nextPlannedStop ? 0.6 : 1
        }}>
              Mark Stop as Delivered
            </button>
            <button type="button" onClick={handleCompleteRoute} disabled={actionLoading || orderedStops.every(stop => stop.status === "delivered")} style={{
          ...buttonStyle,
          background: "var(--info-dark)",
          color: "var(--surface)",
          opacity: actionLoading || orderedStops.every(stop => stop.status === "delivered") ? 0.6 : 1
        }}>
              Complete Route
            </button>
          </div>
          {error && <p style={{
        color: "var(--danger)",
        margin: 0
      }}>{error}</p>}
        </section>

        {loading && <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 10
    }}>
            <SkeletonKeyframes />
            {Array.from({
        length: 3
      }).map((_, i) => <div key={i} style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr auto",
        gap: 12,
        padding: 12,
        borderRadius: "var(--radius-md)",
        background: "var(--surface)"
      }}>
                <SkeletonBlock width="32px" height="32px" borderRadius="999px" />
                <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 6
        }}>
                  <SkeletonBlock width="60%" height="12px" />
                  <SkeletonBlock width="80%" height="10px" />
                </div>
                <SkeletonBlock width="60px" height="20px" />
              </div>)}
          </div>}

        {!loading && !orderedStops.length && <p style={{
      color: "var(--info)"
    }}>No stops have been planned for this route yet.</p>}

        {!loading && orderedStops.length > 0 && <ol style={{
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      padding: 0
    }}>
            {orderedStops.map(stop => {
        const customerName = stop?.customer?.name || [stop?.customer?.firstname, stop?.customer?.lastname].filter(Boolean).join(" ") || "Customer";
        const statusMeta = STATUS_META[stop.status] || STATUS_META.planned;
        const isDropTarget = dropTargetId === stop.id;
        const isDragging = draggedStopId === stop.id;
        return <li key={stop.id} style={{
          listStyle: "none",
          cursor: "grab"
        }} draggable onDragStart={handleDragStart(stop.id)} onDragOver={handleDragOver(stop.id)} onDrop={handleDrop(stop.id)} onDragEnd={handleDragEnd}>
                  <div style={{
            ...stopCardStyle,
            borderColor: isDropTarget ? "var(--primary)" : "var(--surface-light)",
            opacity: isDragging ? 0.7 : 1
          }}>
                    <div style={{
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px"
            }}>
                      <div>
                        <p style={{
                  margin: 0,
                  fontWeight: 600,
                  fontSize: "0.95rem"
                }}>
                          {stop.stop_number}. {customerName}
                        </p>
                        <p style={{
                  margin: "4px 0 0",
                  color: "var(--info)"
                }}>
                          {stop.customer?.address || stop.address || "Address TBC"}
                        </p>
                        <p style={{
                  margin: "2px 0 0",
                  color: "var(--info)"
                }}>
                          {stop.customer?.postcode || stop.postcode || "Postcode TBC"}
                        </p>
                      </div>
                      <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "8px"
              }}>
                        <span style={{
                  padding: "6px 14px",
                  borderRadius: "var(--radius-pill)",
                  background: statusMeta.background,
                  color: statusMeta.color,
                  fontWeight: 600,
                  fontSize: "0.85rem"
                }}>
                          {statusMeta.label}
                        </span>
                        <button type="button" onClick={() => handleDeleteStop(stop.id)} style={{
                  borderRadius: "var(--radius-xs)",
                  border: "none",
                  padding: "6px 10px",
                  background: "var(--surface)",
                  color: "var(--primary)",
                  fontWeight: 600,
                  cursor: "pointer"
                }}>
                          Delete
                        </button>
                      </div>
                    </div>
                    <div style={{
              marginTop: "12px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap"
            }}>
                      <label style={{
                margin: 0,
                fontSize: "0.8rem",
                color: "var(--info)",
                fontWeight: 600
              }}>
                        Update status
                      </label>
                      <select value={stop.status || "planned"} onChange={event => handleStatusUpdate([stop.id], event.target.value)} style={{
                borderRadius: "var(--radius-sm)",
                border: "none",
                padding: "8px 12px",
                fontWeight: 600,
                color: "var(--primary-dark)",
                minWidth: "160px",
                background: "var(--surface)"
              }}>
                        <option value="planned">Planned</option>
                        <option value="en_route">En Route</option>
                        <option value="delivered">Delivered</option>
                      </select>
                    </div>
                    <div style={{
              marginTop: "8px",
              display: "flex",
              gap: "8px",
              flexWrap: "wrap"
            }}>
                      <button type="button" onClick={() => handleStatusUpdate([stop.id], "delivered")} style={{
                borderRadius: "var(--radius-xs)",
                border: "none",
                background: "var(--primary)",
                color: "var(--surface)",
                padding: "6px 12px",
                fontWeight: 600,
                cursor: "pointer"
              }}>
                        Mark stop as delivered
                      </button>
                      <button type="button" onClick={() => startNoteEditing(stop)} style={{
                borderRadius: "var(--radius-xs)",
                border: "none",
                background: "var(--surface)",
                color: "var(--primary-dark)",
                padding: "6px 12px",
                fontWeight: 600,
                cursor: "pointer"
              }}>
                        Add delivery notes
                      </button>
                      {stop.job?.job_number && <button type="button" onClick={() => handleConfirmDelivery(stop)} disabled={stop.status === "delivered" || actionLoading} style={{
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--accent-purple)",
                background: "var(--accent-purple)",
                color: "var(--surface)",
                padding: "6px 12px",
                fontWeight: 600,
                cursor: stop.status === "delivered" ? "default" : "pointer",
                opacity: stop.status === "delivered" || actionLoading ? 0.6 : 1
              }}>
                          Confirm Delivery
                        </button>}
                    </div>
                    <div style={{
              marginTop: "12px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "10px",
              color: "var(--info-dark)"
            }}>
                      {stop.job?.job_number && <div>
                          <p style={{
                  margin: 0,
                  fontSize: "0.75rem"
                }}>Job number</p>
                          <p style={{
                  margin: "4px 0 0",
                  fontWeight: 600
                }}>{stop.job.job_number}</p>
                        </div>}
                      <div>
                        <p style={{
                  margin: 0,
                  fontSize: "0.75rem"
                }}>Mileage for leg</p>
                        <p style={{
                  margin: "4px 0 0",
                  fontWeight: 600
                }}>
                          {Number(stop.mileage_for_leg || 0).toLocaleString()} km
                        </p>
                      </div>
                      <div>
                        <p style={{
                  margin: 0,
                  fontSize: "0.75rem"
                }}>Estimated fuel</p>
                        <p style={{
                  margin: "4px 0 0",
                  fontWeight: 600
                }}>
                          {formatCurrency(stop.estimated_fuel_cost)}
                        </p>
                      </div>
                    </div>
                    {stop.notes && noteEditingId !== stop.id && <p style={{
              marginTop: "12px",
              color: "var(--info-dark)",
              fontSize: "0.9rem"
            }}>
                        <strong>Note:</strong> {stop.notes}
                      </p>}
                    {noteEditingId === stop.id && <div style={{
              marginTop: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}>
                        <textarea value={noteDraft} onChange={event => setNoteDraft(event.target.value)} rows={3} placeholder="Capture delivery notes…" style={{
                borderRadius: "var(--radius-sm)",
                border: "none",
                padding: "10px",
                resize: "vertical",
                width: "100%"
              }} />
                        <div style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap"
              }}>
                          <button type="button" onClick={handleSaveNote} disabled={noteSaving} style={{
                  ...buttonStyle,
                  background: "var(--info-dark)",
                  color: "var(--surface)",
                  padding: "6px 12px",
                  opacity: noteSaving ? 0.6 : 1
                }}>
                            {noteSaving ? "Saving…" : "Save note"}
                          </button>
                          <button type="button" onClick={cancelNoteEditing} style={{
                  ...buttonStyle,
                  background: "var(--surface)",
                  border: "none",
                  color: "var(--primary-dark)",
                  padding: "6px 12px"
                }}>
                            Cancel
                          </button>
                        </div>
                      </div>}
                  </div>
                </li>;
      })}
          </ol>}
      </div>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
