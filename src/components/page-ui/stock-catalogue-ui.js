// file location: src/components/page-ui/stock-catalogue-ui.js

export default function StockCataloguePageUi(props) {
  const {
    ConfirmationDialog,
    JOB_PART_STATUSES,
    PRE_PICK_OPTIONS,
    RequirementBadge,
    STORAGE_LOCATION_CODES,
    SearchBar,
    buttonStyle,
    cardStyle,
    confirmDialog,
    displayLimit,
    displayedJobParts,
    editedPart,
    filterType,
    formatCurrency,
    formatDateTime,
    formatMargin,
    formatStatusLabel,
    getPipelineStageMeta,
    handleCancelEdit,
    handleEditPart,
    handleJobPartUpdate,
    handleSavePart,
    inventory,
    inventoryError,
    inventoryLoading,
    inventorySearch,
    isEditMode,
    isPartModalOpen,
    isSavingPart,
    jobCardSectionExpanded,
    jobData,
    jobError,
    jobLoading,
    jobParts,
    jobRequests,
    jobSearch,
    locationFilter,
    locationSearchTerm,
    mapPartStatusToPipelineId,
    matchesLinkedJobStatus,
    partsPipeline,
    pendingJobParts,
    popupCardStyles,
    popupOverlayStyles,
    renderAddToJobModal,
    renderDeliveryModal,
    resetAddToJobModal,
    resolveSourceMeta,
    resolveStatusStyles,
    searchJob,
    secondaryButtonStyle,
    sectionTitleStyle,
    selectedPart,
    selectedPipelineStage,
    setConfirmDialog,
    setDisplayLimit,
    setEditedPart,
    setFilterType,
    setInventorySearch,
    setIsEditMode,
    setIsPartModalOpen,
    setJobCardSectionExpanded,
    setJobSearch,
    setLocationFilter,
    setLocationSearchTerm,
    setSelectedPart,
    setSelectedPipelineStage,
    setShowAddToJobModal,
    setStatusFilter,
    statusFilter,
    tableStyle,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <div style={{
    padding: "24px",
    maxWidth: "100%",
    margin: "0 auto"
  }}>
        <div style={{
      ...cardStyle,
      marginBottom: "20px"
    }}>
          <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "12px"
      }}>
            <h2 style={sectionTitleStyle}>Find Job Card</h2>
            <button onClick={() => setJobCardSectionExpanded(!jobCardSectionExpanded)} style={buttonStyle}>
              {jobCardSectionExpanded ? "Collapse" : "Search Job"}
            </button>
          </div>

          {jobCardSectionExpanded && <>
              <form onSubmit={event => {
          event.preventDefault();
          searchJob(jobSearch);
        }} style={{
          display: "flex",
          gap: "12px",
          marginBottom: "16px"
        }}>
                <input type="text" placeholder="Job number or registration" value={jobSearch} onChange={event => setJobSearch(event.target.value)} style={{
            flex: 1,
            padding: "12px",
            borderRadius: "var(--radius-xs)",
            border: "none"
          }} />
                <button type="submit" style={buttonStyle} disabled={jobLoading}>
                  {jobLoading ? "Searching..." : "Search"}
                </button>
              </form>

              {jobError && <div style={{
          color: "var(--danger)",
          marginBottom: "12px",
          fontWeight: 600
        }}>
                  {jobError}
                </div>}

              {jobData ? <>
                  <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "12px",
            marginBottom: "16px"
          }}>
                    <div style={{
              background: "var(--surface-light)",
              borderRadius: "var(--radius-sm)",
              padding: "14px",
              border: "none"
            }}>
                      <div style={{
                fontSize: "var(--text-label)",
                color: "var(--danger)"
              }}>JOB</div>
                      <div style={{
                fontSize: "var(--text-h3)",
                fontWeight: 700,
                color: "var(--primary)"
              }}>
                        {jobData.jobNumber}
                      </div>
                      <div>{jobData.description || "No description"}</div>
                    </div>
                    <div style={{
              background: "var(--surface-light)",
              borderRadius: "var(--radius-sm)",
              padding: "14px",
              border: "none"
            }}>
                      <div style={{
                fontSize: "var(--text-label)",
                color: "var(--danger)"
              }}>VEHICLE</div>
                      <div style={{
                fontSize: "var(--text-h3)",
                fontWeight: 700
              }}>{jobData.reg}</div>
                      <div>{jobData.makeModel || `${jobData.make} ${jobData.model}`}</div>
                    </div>
                    <div style={{
              background: "var(--surface-light)",
              borderRadius: "var(--radius-sm)",
              padding: "14px",
              border: "none"
            }}>
                      <div style={{
                fontSize: "var(--text-label)",
                color: "var(--danger)"
              }}>STATUS</div>
                      <div style={{
                fontSize: "var(--text-h3)",
                fontWeight: 700
              }}>
                        {jobData.status}
                      </div>
                      <div>{jobData.waitingStatus}</div>
                    </div>
                  </div>

                  <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px"
          }}>
                    <h3 style={{
              ...sectionTitleStyle,
              marginBottom: 0
            }}>
                      Parts on this Job
                    </h3>
                  </div>

                  {jobParts.length > 0 && <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "12px"
          }}>
                      <button type="button" onClick={() => setSelectedPipelineStage("all")} aria-pressed={selectedPipelineStage === "all"} style={{
              borderRadius: "var(--radius-md)",
              border: "none",
              backgroundColor: selectedPipelineStage === "all" ? "var(--danger-surface)" : "var(--surface)",
              padding: "8px 14px",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "2px",
              cursor: "pointer",
              fontWeight: 600,
              color: selectedPipelineStage === "all" ? "var(--primary)" : "var(--primary-dark)"
            }}>
                        <span>All Parts</span>
                        <small style={{
                fontSize: "var(--text-caption)",
                color: "var(--grey-accent-dark)"
              }}>
                          {jobParts.length} line{jobParts.length === 1 ? "" : "s"} total
                        </small>
                      </button>
                      {partsPipeline.stageSummary.map(stage => <button key={stage.id} type="button" onClick={() => setSelectedPipelineStage(stage.id)} aria-pressed={selectedPipelineStage === stage.id} style={{
              borderRadius: "var(--radius-md)",
              border: "none",
              backgroundColor: selectedPipelineStage === stage.id ? "var(--danger-surface)" : "var(--surface)",
              padding: "8px 14px",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "2px",
              cursor: "pointer",
              fontWeight: 600,
              color: selectedPipelineStage === stage.id ? "var(--primary)" : "var(--primary-dark)"
            }}>
                          <span>{stage.label}</span>
                          <small style={{
                fontSize: "var(--text-caption)",
                color: "var(--grey-accent-dark)"
              }}>
                            {stage.count} line{stage.count === 1 ? "" : "s"}
                          </small>
                        </button>)}
                    </div>}

                  {selectedPipelineStage !== "all" && displayedJobParts.length === 0 && <div style={{
            background: "var(--warning-surface)",
            borderRadius: "var(--radius-sm)",
            border: "none",
            padding: "10px 14px",
            marginBottom: "12px",
            color: "var(--danger-dark)",
            fontSize: "var(--text-body)"
          }}>
                      No parts currently staged for{" "}
                      {getPipelineStageMeta(selectedPipelineStage).label}.
                    </div>}

                  {jobParts.length === 0 ? <div style={{
            background: "var(--surface-light)",
            border: "1px dashed var(--primary-light)",
            borderRadius: "var(--radius-xs)",
            padding: "16px",
            color: "var(--danger)",
            textAlign: "center"
          }}>
                      No parts linked to this job. Add required parts to get started.
                    </div> : <div style={{
            overflowX: "auto"
          }}>
                      <table style={tableStyle}>
                        <thead>
                          <tr style={{
                  background: "var(--surface-light)",
                  color: "var(--danger)"
                }}>
                            <th style={{
                    textAlign: "left",
                    padding: "10px"
                  }}>Part</th>
                            <th style={{
                    textAlign: "left",
                    padding: "10px"
                  }}>Qty</th>
                            <th style={{
                    textAlign: "left",
                    padding: "10px"
                  }}>Stage</th>
                            <th style={{
                    textAlign: "left",
                    padding: "10px"
                  }}>Status</th>
                            <th style={{
                    textAlign: "left",
                    padding: "10px"
                  }}>Pre-pick</th>
                            <th style={{
                    textAlign: "left",
                    padding: "10px"
                  }}>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedJobParts.map(part => {
                  const stageId = mapPartStatusToPipelineId(part.status);
                  const stageMeta = getPipelineStageMeta(stageId);
                  return <tr key={part.id} style={{
                    borderBottom: "1px solid var(--surface-light)"
                  }}>
                              <td style={{
                      padding: "10px",
                      verticalAlign: "top"
                    }}>
                                <div style={{
                        fontWeight: 600
                      }}>
                                  {part.part?.part_number} · {part.part?.name}
                                </div>
                                <div style={{
                        fontSize: "var(--text-body-sm)",
                        color: "var(--grey-accent-dark)"
                      }}>
                                  {part.part?.storage_location || "No bin"} · Stock:{" "}
                                  {part.part?.qty_in_stock}
                                </div>
                                <div style={{
                        marginTop: "6px",
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap"
                      }}>
                                  {(() => {
                          const meta = resolveSourceMeta(part.origin);
                          return <RequirementBadge label={meta.label} background={meta.background} color={meta.color} />;
                        })()}
                                  {part.vhc_item_id ? <RequirementBadge label={`VHC #${part.vhc_item_id}`} background="rgba(var(--danger-rgb), 0.18)" color="var(--danger)" /> : null}
                                </div>
                              </td>
                              <td style={{
                      padding: "10px",
                      verticalAlign: "top"
                    }}>
                                <div>Requested: {part.quantity_requested}</div>
                                <div>Allocated: {part.quantity_allocated}</div>
                                <div>Fitted: {part.quantity_fitted}</div>
                                <button onClick={() => handleJobPartUpdate(part.id, {
                        quantityFitted: part.quantity_allocated,
                        status: "fitted"
                      })} style={{
                        ...secondaryButtonStyle,
                        marginTop: "6px",
                        padding: "6px 10px",
                        fontSize: "var(--text-label)"
                      }}>
                                  Mark fitted
                                </button>
                              </td>
                              <td style={{
                      padding: "10px",
                      verticalAlign: "top"
                    }}>
                                <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 10px",
                        borderRadius: "var(--radius-pill)",
                        fontSize: "var(--text-label)",
                        fontWeight: 600,
                        backgroundColor: "var(--surface-light)",
                        color: "var(--danger)",
                        marginBottom: "6px"
                      }}>
                                  {stageMeta.label}
                                </span>
                                <div style={{
                        fontSize: "var(--text-caption)",
                        color: "var(--grey-accent-dark)"
                      }}>
                                  {stageMeta.description}
                                </div>
                              </td>
                              <td style={{
                      padding: "10px",
                      verticalAlign: "top"
                    }}>
                                <select value={part.status} onChange={event => handleJobPartUpdate(part.id, {
                        status: event.target.value
                      })} style={{
                        width: "170px",
                        padding: "8px",
                        borderRadius: "var(--radius-xs)",
                        border: "none"
                      }}>
                                  {JOB_PART_STATUSES.map(statusValue => <option key={statusValue} value={statusValue}>
                                      {statusValue.replace(/_/g, " ")}
                                    </option>)}
                                </select>
                              </td>
                              <td style={{
                      padding: "10px",
                      verticalAlign: "top"
                    }}>
                                <select value={part.pre_pick_location || ""} onChange={event => handleJobPartUpdate(part.id, {
                        prePickLocation: event.target.value
                      })} style={{
                        width: "170px",
                        padding: "8px",
                        borderRadius: "var(--radius-xs)",
                        border: "none"
                      }}>
                                  {PRE_PICK_OPTIONS.map(option => <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>)}
                                </select>
                                <div style={{
                        marginTop: "8px"
                      }}>
                                  <button onClick={() => handleJobPartUpdate(part.id, {
                          status: "cancelled"
                        })} style={{
                          ...secondaryButtonStyle,
                          padding: "6px 10px",
                          fontSize: "var(--text-label)"
                        }}>
                                    Cancel
                                  </button>
                                </div>
                              </td>
                              <td style={{
                      padding: "10px",
                      verticalAlign: "top",
                      fontSize: "var(--text-body)"
                    }}>
                                {part.request_notes || "—"}
                              </td>
                            </tr>;
                })}
                        </tbody>
                      </table>
                    </div>}

                  {jobRequests.length > 0 && <div style={{
            marginTop: "20px"
          }}>
                      <h4 style={{
              ...sectionTitleStyle,
              marginBottom: "8px"
            }}>Workshop Requests</h4>
                      <div style={{
              overflowX: "auto"
            }}>
                        <table style={{
                ...tableStyle,
                fontSize: "var(--text-body)"
              }}>
                          <thead>
                            <tr style={{
                    background: "var(--warning-surface)",
                    color: "var(--danger-dark)"
                  }}>
                              <th style={{
                      textAlign: "left",
                      padding: "10px"
                    }}>Request</th>
                              <th style={{
                      textAlign: "left",
                      padding: "10px"
                    }}>Quantity</th>
                              <th style={{
                      textAlign: "left",
                      padding: "10px"
                    }}>Source</th>
                              <th style={{
                      textAlign: "left",
                      padding: "10px"
                    }}>Status</th>
                              <th style={{
                      textAlign: "left",
                      padding: "10px"
                    }}>Created</th>
                            </tr>
                          </thead>
                          <tbody>
                            {jobRequests.map(request => {
                    const sourceMeta = resolveSourceMeta(request.source);
                    const statusMeta = resolveStatusStyles(request.status);
                    return <tr key={request.request_id} style={{
                      borderBottom: "1px solid var(--surface-light)"
                    }}>
                                  <td style={{
                        padding: "10px"
                      }}>
                                    <div style={{
                          fontWeight: 600
                        }}>{request.description || "Part request"}</div>
                                    {request.part ? <div style={{
                          fontSize: "var(--text-label)",
                          color: "var(--info)"
                        }}>
                                        Suggested: {request.part.part_number} · {request.part.name}
                                      </div> : null}
                                  </td>
                                  <td style={{
                        padding: "10px"
                      }}>{request.quantity || 1}</td>
                                  <td style={{
                        padding: "10px"
                      }}>
                                    <RequirementBadge label={sourceMeta.label} background={sourceMeta.background} color={sourceMeta.color} />
                                  </td>
                                  <td style={{
                        padding: "10px"
                      }}>
                                    <RequirementBadge label={formatStatusLabel(request.status)} background={statusMeta.background} color={statusMeta.color} />
                                  </td>
                                  <td style={{
                        padding: "10px"
                      }}>{formatDateTime(request.created_at)}</td>
                                </tr>;
                  })}
                          </tbody>
                        </table>
                      </div>
                    </div>}

                  {pendingJobParts.length > 0 && <div style={{
            marginTop: "20px",
            padding: "16px",
            borderRadius: "var(--radius-xs)",
            background: "var(--warning-surface)",
            border: "1px solid var(--warning)",
            color: "var(--warning-dark)"
          }}>
                      <strong>{pendingJobParts.length} part(s)</strong> awaiting stock or action for
                      this VHC. Ensure orders are raised or picked.
                    </div>}
                </> : <div style={{
          background: "var(--surface-light)",
          border: "1px dashed var(--primary-light)",
          borderRadius: "var(--radius-xs)",
          padding: "16px",
          color: "var(--danger)",
          textAlign: "center"
        }}>
                  Search a job to view current parts requirements.
                </div>}
            </>}
        </div>

        <div style={{
      ...cardStyle,
      marginTop: "20px"
    }} id="stock-catalogue">
          <h2 style={sectionTitleStyle}>Stock Catalogue</h2>

          {/* Search and Filter Controls */}
          <div style={{
        display: "flex",
        gap: "12px",
        marginBottom: "12px",
        alignItems: "center"
      }}>
            <SearchBar placeholder="Search part number, description, OEM code" value={inventorySearch} onChange={event => setInventorySearch(event.target.value)} onClear={() => setInventorySearch("")} style={{
          flex: 1
        }} />

            {/* Two-step filter dropdown */}
            <div style={{
          display: "flex",
          gap: "8px"
        }}>
              <select value={filterType} onChange={e => {
            setFilterType(e.target.value);
            setStatusFilter("all");
            setLocationFilter("all");
          }} style={{
            padding: "12px",
            borderRadius: "var(--radius-xs)",
            border: "none",
            background: "var(--layer-section-level-1)",
            color: "var(--text-primary)",
            fontSize: "var(--text-body)",
            minWidth: "140px"
          }}>
                <option value="status">Filter by Status</option>
                <option value="location">Filter by Location</option>
              </select>

              {filterType === "status" && <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
            padding: "12px",
            borderRadius: "var(--radius-xs)",
            border: "none",
            background: "var(--layer-section-level-1)",
            color: "var(--text-primary)",
            fontSize: "var(--text-body)",
            minWidth: "140px"
          }}>
                  <option value="all">All Status</option>
                  <option value="low_stock">Low Stock</option>
                  <option value="in_stock">Good Stock</option>
                  <option value="high_stock">High Stock</option>
                  <option value="back_order">Back Order</option>
                </select>}

              {filterType === "location" && <div style={{
            position: "relative"
          }}>
                  <input type="text" placeholder="Search location..." value={locationSearchTerm} onChange={e => setLocationSearchTerm(e.target.value)} onFocus={() => {
              document.getElementById('location-dropdown').style.display = 'block';
            }} style={{
              padding: "12px",
              borderRadius: "var(--radius-xs)",
              border: "none",
              background: "var(--layer-section-level-1)",
              color: "var(--text-primary)",
              fontSize: "var(--text-body)",
              minWidth: "140px",
              outline: "none"
            }} />
                  <div id="location-dropdown" style={{
              display: "none",
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              marginTop: "4px",
              background: "var(--surface)",
              border: "none",
              borderRadius: "var(--radius-xs)",
              maxHeight: "300px",
              overflowY: "auto",
              zIndex: 1000,
              boxShadow: "var(--shadow-md)"
            }}>
                    <div onClick={() => {
                setLocationFilter("all");
                setLocationSearchTerm("");
                document.getElementById('location-dropdown').style.display = 'none';
              }} style={{
                padding: "10px 12px",
                cursor: "pointer",
                borderBottom: "1px solid var(--surface-light)",
                fontWeight: locationFilter === "all" ? 600 : 400,
                background: locationFilter === "all" ? "var(--surface-light)" : "transparent"
              }} onMouseEnter={e => {
                e.currentTarget.style.background = "var(--surface-light)";
              }} onMouseLeave={e => {
                e.currentTarget.style.background = locationFilter === "all" ? "var(--surface-light)" : "transparent";
              }}>
                      All Locations
                    </div>
                    {STORAGE_LOCATION_CODES.filter(code => code.toLowerCase().includes(locationSearchTerm.toLowerCase())).map(code => <div key={code} onClick={() => {
                setLocationFilter(code);
                setLocationSearchTerm(code);
                document.getElementById('location-dropdown').style.display = 'none';
              }} style={{
                padding: "10px 12px",
                cursor: "pointer",
                fontWeight: locationFilter === code ? 600 : 400,
                background: locationFilter === code ? "var(--surface-light)" : "transparent"
              }} onMouseEnter={e => {
                e.currentTarget.style.background = "var(--surface-light)";
              }} onMouseLeave={e => {
                e.currentTarget.style.background = locationFilter === code ? "var(--surface-light)" : "transparent";
              }}>
                          {code}
                        </div>)}
                  </div>
                </div>}
            </div>
          </div>

          {inventoryError && <div style={{
        color: "var(--danger)",
        marginBottom: "12px",
        fontWeight: 600
      }}>
              {inventoryError}
            </div>}

          <div style={{
        maxHeight: "600px",
        overflowY: "auto"
      }}>
            {inventoryLoading ? <div style={{
          color: "var(--grey-accent-light)"
        }}>Loading inventory...</div> : inventory.length === 0 ? <div style={{
          color: "var(--grey-accent-light)"
        }}>No parts found. Refine your search.</div> : <>
                <table style={{
            ...tableStyle,
            fontSize: "var(--text-body)"
          }}>
                  <thead>
                    <tr style={{
                background: "var(--surface-light)",
                color: "var(--danger)"
              }}>
                      <th style={{
                  textAlign: "left",
                  padding: "10px"
                }}>Part Number</th>
                      <th style={{
                  textAlign: "left",
                  padding: "10px"
                }}>Part Description</th>
                      <th style={{
                  textAlign: "left",
                  padding: "10px"
                }}>Stock Location</th>
                      <th style={{
                  textAlign: "right",
                  padding: "10px"
                }}>In Stock</th>
                      <th style={{
                  textAlign: "left",
                  padding: "10px"
                }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.filter(part => {
                // Apply status filter
                if (filterType === "status" && statusFilter !== "all") {
                  if (part.stock_status !== statusFilter) return false;
                }
                // Apply location filter
                if (filterType === "location" && locationFilter !== "all") {
                  if (part.storage_location !== locationFilter) return false;
                }
                return true;
              }).slice(0, displayLimit).map(part => <tr key={part.id} onClick={() => {
                setSelectedPart(part);
                setIsPartModalOpen(true);
              }} style={{
                borderBottom: "1px solid var(--surface-light)",
                cursor: "pointer",
                transition: "background 0.15s ease"
              }} onMouseEnter={e => {
                e.currentTarget.style.background = "var(--surface-light)";
              }} onMouseLeave={e => {
                e.currentTarget.style.background = "transparent";
              }}>
                          <td style={{
                  padding: "10px",
                  fontWeight: 600,
                  color: "var(--primary)"
                }}>
                            {part.part_number}
                          </td>
                          <td style={{
                  padding: "10px"
                }}>{part.name}</td>
                          <td style={{
                  padding: "10px",
                  color: "var(--text-secondary)"
                }}>
                            {part.storage_location || "—"}
                          </td>
                          <td style={{
                  padding: "10px",
                  textAlign: "right",
                  fontWeight: 600
                }}>
                            {part.qty_in_stock}
                          </td>
                          <td style={{
                  padding: "10px"
                }}>
                            <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 10px",
                    borderRadius: "var(--radius-pill)",
                    background: part.stock_status === "low_stock" ? "rgba(var(--warning-rgb), 0.2)" : part.stock_status === "back_order" ? "rgba(var(--danger-rgb), 0.2)" : part.stock_status === "high_stock" ? "rgba(var(--success-rgb), 0.2)" : "rgba(var(--info-rgb), 0.18)",
                    color: part.stock_status === "low_stock" ? "var(--danger-dark)" : part.stock_status === "back_order" ? "var(--danger)" : part.stock_status === "high_stock" ? "var(--success-dark)" : "var(--info-dark)",
                    fontSize: "var(--text-caption)",
                    fontWeight: 600
                  }}>
                              {(part.stock_status || "in_stock").replace(/_/g, " ")}
                            </span>
                          </td>
                        </tr>)}
                  </tbody>
                </table>

                {/* Load More Button */}
                {(() => {
            const filteredInventory = inventory.filter(part => {
              if (filterType === "status" && statusFilter !== "all") {
                if (part.stock_status !== statusFilter) return false;
              }
              if (filterType === "location" && locationFilter !== "all") {
                if (part.storage_location !== locationFilter) return false;
              }
              return true;
            });
            return filteredInventory.length > displayLimit && <div style={{
              textAlign: "center",
              marginTop: "16px"
            }}>
                      <button onClick={() => setDisplayLimit(prev => prev + 20)} style={{
                ...buttonStyle,
                padding: "10px 24px"
              }}>
                        Load More ({filteredInventory.length - displayLimit} remaining)
                      </button>
                    </div>;
          })()}
              </>}
          </div>
        </div>

        {/* Part Details Modal */}
        {isPartModalOpen && selectedPart && <div className="popup-backdrop" role="dialog" aria-modal="true" style={popupOverlayStyles} onClick={() => setIsPartModalOpen(false)}>
            <div style={{
        ...popupCardStyles,
        maxWidth: "1000px",
        maxHeight: "90vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: "28px"
      }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: "16px",
          borderBottom: "1px solid var(--surface-light)",
          marginBottom: "20px"
        }}>
                <div style={{
            flex: 1
          }}>
                  <h2 style={{
              margin: 0,
              color: "var(--primary)",
              fontSize: "var(--text-h2)",
              fontWeight: 700
            }}>
                    {selectedPart.part_number}
                  </h2>
                  <p style={{
              margin: "6px 0 0 0",
              color: "var(--text-secondary)",
              fontSize: "var(--text-body)"
            }}>
                    {selectedPart.name}
                  </p>
                </div>
                <div style={{
            display: "flex",
            gap: "8px"
          }}>
                  {!isEditMode ? <button onClick={handleEditPart} style={{
              background: "var(--primary)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-xs)",
              padding: "8px 16px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "var(--text-body)"
            }}>
                      Edit
                    </button> : <>
                      <button onClick={handleSavePart} disabled={isSavingPart} style={{
                background: isSavingPart ? "var(--surface-light)" : "var(--success)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-xs)",
                padding: "8px 16px",
                cursor: isSavingPart ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: "var(--text-body)"
              }}>
                        {isSavingPart ? "Saving..." : "Save"}
                      </button>
                      <button onClick={handleCancelEdit} disabled={isSavingPart} style={{
                background: "var(--surface-light)",
                color: "var(--text-primary)",
                border: "none",
                borderRadius: "var(--radius-xs)",
                padding: "8px 16px",
                cursor: isSavingPart ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: "var(--text-body)"
              }}>
                        Cancel
                      </button>
                    </>}
                  <button onClick={() => {
              setIsPartModalOpen(false);
              setIsEditMode(false);
              setEditedPart(null);
            }} style={{
              background: "var(--surface-light)",
              border: "none",
              borderRadius: "var(--radius-xs)",
              fontSize: "var(--text-h2)",
              cursor: "pointer",
              color: "var(--text-secondary)",
              padding: "8px",
              width: "var(--control-height-xs)",
              height: "var(--control-height-xs)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease"
            }} onMouseEnter={e => {
              e.currentTarget.style.background = "var(--danger-light)";
              e.currentTarget.style.color = "var(--danger)";
            }} onMouseLeave={e => {
              e.currentTarget.style.background = "var(--surface-light)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}>
                  ×
                </button>
              </div>
              </div>

              {/* Scrollable Content */}
              <div style={{
          flex: 1,
          overflow: "auto",
          paddingRight: "12px"
        }}>
                {/* Two Column Layout */}
                <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
            marginBottom: "20px"
          }}>
                  {/* Left Column - Stock & Pricing */}
                  <div>
                    {/* Stock Overview Card */}
                    <div style={{
                background: "var(--layer-section-level-1)",
                borderRadius: "var(--radius-sm)",
                padding: "16px",
                marginBottom: "16px",
                border: "none"
              }}>
                      <h3 style={{
                  fontSize: "var(--text-body)",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                        Stock Overview
                      </h3>
                      <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px"
                }}>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-secondary)",
                      marginBottom: "4px"
                    }}>On Hand</div>
                          {isEditMode ? <input type="number" value={editedPart?.qty_in_stock ?? selectedPart.qty_in_stock} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      qty_in_stock: parseInt(e.target.value) || 0
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <div style={{
                      fontSize: "var(--text-h2)",
                      fontWeight: 700,
                      color: "var(--primary)"
                    }}>{selectedPart.qty_in_stock}</div>}
                        </div>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-secondary)",
                      marginBottom: "4px"
                    }}>Reserved</div>
                          {isEditMode ? <input type="number" value={editedPart?.qty_reserved ?? selectedPart.qty_reserved ?? 0} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      qty_reserved: parseInt(e.target.value) || 0
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <div style={{
                      fontSize: "var(--text-h2)",
                      fontWeight: 700
                    }}>{selectedPart.qty_reserved || 0}</div>}
                        </div>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-secondary)",
                      marginBottom: "4px"
                    }}>On Order</div>
                          {isEditMode ? <input type="number" value={editedPart?.qty_on_order ?? selectedPart.qty_on_order ?? 0} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      qty_on_order: parseInt(e.target.value) || 0
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <div style={{
                      fontSize: "var(--text-h2)",
                      fontWeight: 700
                    }}>{selectedPart.qty_on_order || 0}</div>}
                        </div>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-secondary)",
                      marginBottom: "4px"
                    }}>Min Level</div>
                          {isEditMode ? <input type="number" value={editedPart?.reorder_level ?? selectedPart.reorder_level ?? 0} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      reorder_level: parseInt(e.target.value) || 0
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <div style={{
                      fontSize: "var(--text-h2)",
                      fontWeight: 700
                    }}>{selectedPart.reorder_level || 0}</div>}
                        </div>
                      </div>
                      <div style={{
                  marginTop: "12px",
                  paddingTop: "12px",
                  borderTop: "1px solid var(--surface-light)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-secondary)"
                    }}>Linked Jobs</div>
                          <div style={{
                      fontSize: "var(--text-h3)",
                      fontWeight: 600
                    }}>{selectedPart.open_job_count || 0}</div>
                        </div>
                        <span style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-pill)",
                    fontSize: "var(--text-caption)",
                    fontWeight: 600,
                    background: selectedPart.stock_status === "low_stock" ? "rgba(var(--warning-rgb), 0.2)" : selectedPart.stock_status === "back_order" ? "rgba(var(--danger-rgb), 0.2)" : selectedPart.stock_status === "high_stock" ? "rgba(var(--success-rgb), 0.2)" : "rgba(var(--info-rgb), 0.18)",
                    color: selectedPart.stock_status === "low_stock" ? "var(--danger-dark)" : selectedPart.stock_status === "back_order" ? "var(--danger)" : selectedPart.stock_status === "high_stock" ? "var(--success-dark)" : "var(--info-dark)"
                  }}>
                          {(selectedPart.stock_status || "in_stock").replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>

                    {/* Pricing Card */}
                    <div style={{
                background: "var(--layer-section-level-1)",
                borderRadius: "var(--radius-sm)",
                padding: "16px",
                border: "none"
              }}>
                      <h3 style={{
                  fontSize: "var(--text-body)",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                        Pricing
                      </h3>
                      <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}>
                        <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                          <span style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--text-secondary)"
                    }}>Cost Price</span>
                          {isEditMode ? <input type="number" step="0.01" value={editedPart?.unit_cost ?? selectedPart.unit_cost} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      unit_cost: parseFloat(e.target.value) || 0
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <span style={{
                      fontSize: "var(--text-h3)",
                      fontWeight: 700
                    }}>{formatCurrency(selectedPart.unit_cost)}</span>}
                        </div>
                        <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                          <span style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--text-secondary)"
                    }}>Sell Price</span>
                          {isEditMode ? <input type="number" step="0.01" value={editedPart?.unit_price ?? selectedPart.unit_price} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      unit_price: parseFloat(e.target.value) || 0
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <span style={{
                      fontSize: "var(--text-h3)",
                      fontWeight: 700,
                      color: "var(--primary)"
                    }}>{formatCurrency(selectedPart.unit_price)}</span>}
                        </div>
                        <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: "8px",
                    borderTop: "1px solid var(--surface-light)"
                  }}>
                          <span style={{
                      fontSize: "var(--text-body-sm)",
                      color: "var(--text-secondary)"
                    }}>Margin</span>
                          <span style={{
                      fontSize: "var(--text-h3)",
                      fontWeight: 700,
                      color: "var(--success-dark)"
                    }}>
                            {isEditMode ? formatMargin(editedPart?.unit_cost ?? selectedPart.unit_cost, editedPart?.unit_price ?? selectedPart.unit_price) : formatMargin(selectedPart.unit_cost, selectedPart.unit_price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Part Info */}
                  <div>
                    <div style={{
                background: "var(--layer-section-level-1)",
                borderRadius: "var(--radius-sm)",
                padding: "16px",
                border: "none",
                height: "100%"
              }}>
                      <h3 style={{
                  fontSize: "var(--text-body)",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                        Part Information
                      </h3>
                      <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  fontSize: "var(--text-body)"
                }}>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-secondary)",
                      marginBottom: "4px",
                      fontWeight: 600
                    }}>DESCRIPTION</div>
                          {isEditMode ? <input type="text" value={editedPart?.name ?? selectedPart.name ?? ""} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      name: e.target.value
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <div style={{
                      color: "var(--text-primary)"
                    }}>{selectedPart.name || "—"}</div>}
                        </div>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-secondary)",
                      marginBottom: "4px",
                      fontWeight: 600
                    }}>STORAGE LOCATION</div>
                          {isEditMode ? <input type="text" value={editedPart?.storage_location ?? selectedPart.storage_location ?? ""} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      storage_location: e.target.value
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <div style={{
                      color: "var(--text-primary)",
                      fontWeight: 600,
                      fontSize: "var(--text-h4)"
                    }}>{selectedPart.storage_location || "—"}</div>}
                        </div>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-secondary)",
                      marginBottom: "4px",
                      fontWeight: 600
                    }}>SERVICE DEFAULT</div>
                          {isEditMode ? <input type="text" value={editedPart?.service_default_zone ?? selectedPart.service_default_zone ?? ""} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      service_default_zone: e.target.value
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <div style={{
                      color: "var(--text-primary)"
                    }}>{selectedPart.service_default_zone || "—"}</div>}
                        </div>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-secondary)",
                      marginBottom: "4px",
                      fontWeight: 600
                    }}>SUPPLIER</div>
                          {isEditMode ? <input type="text" value={editedPart?.supplier ?? selectedPart.supplier ?? ""} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      supplier: e.target.value
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <div style={{
                      color: "var(--text-primary)"
                    }}>{selectedPart.supplier || "Unknown"}</div>}
                        </div>
                        <div>
                          <div style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--text-secondary)",
                      marginBottom: "4px",
                      fontWeight: 600
                    }}>CATEGORY</div>
                          {isEditMode ? <input type="text" value={editedPart?.category ?? selectedPart.category ?? ""} onChange={e => setEditedPart(prev => ({
                      ...prev,
                      category: e.target.value
                    }))} style={{
                      padding: "8px",
                      borderRadius: "var(--radius-xs)",
                      border: "none",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-h4)",
                      fontWeight: 600,
                      width: "100%"
                    }} /> : <div style={{
                      color: "var(--text-primary)"
                    }}>{selectedPart.category || "Uncategorised"}</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Linked Jobs Table */}
                <div style={{
            background: "var(--layer-section-level-1)",
            borderRadius: "var(--radius-sm)",
            padding: "16px",
            border: "none"
          }}>
                  <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "12px"
            }}>
                    <h3 style={{
                fontSize: "var(--text-body)",
                fontWeight: 600,
                color: "var(--text-secondary)",
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                      Linked Jobs {selectedPart.linked_jobs && selectedPart.linked_jobs.filter(link => matchesLinkedJobStatus(link.status)).length > 0 && `(${selectedPart.linked_jobs.filter(link => matchesLinkedJobStatus(link.status)).length})`}
                    </h3>
                    <button type="button" onClick={() => {
                setShowAddToJobModal(true);
                resetAddToJobModal();
              }} style={{
                ...secondaryButtonStyle,
                padding: "6px 12px",
                fontSize: "var(--text-caption)",
                textTransform: "uppercase",
                letterSpacing: "0.04em"
              }}>
                      Add part to job
                    </button>
                  </div>
                  {selectedPart.linked_jobs && selectedPart.linked_jobs.filter(link => matchesLinkedJobStatus(link.status)).length > 0 ? <div style={{
              overflowX: "auto",
              overflowY: selectedPart.linked_jobs.filter(link => matchesLinkedJobStatus(link.status)).length > 4 ? "auto" : "visible",
              maxHeight: selectedPart.linked_jobs.filter(link => matchesLinkedJobStatus(link.status)).length > 4 ? "240px" : "none"
            }}>
                      <table style={{
                ...tableStyle,
                fontSize: "var(--text-body-sm)"
              }}>
                        <thead>
                          <tr style={{
                    background: "var(--surface)",
                    color: "var(--text-secondary)",
                    fontSize: "var(--text-caption)",
                    textTransform: "uppercase"
                  }}>
                            <th style={{
                      textAlign: "left",
                      padding: "10px",
                      fontWeight: 600
                    }}>Job Number</th>
                            <th style={{
                      textAlign: "right",
                      padding: "10px",
                      fontWeight: 600
                    }}>Qty</th>
                            <th style={{
                      textAlign: "left",
                      padding: "10px",
                      fontWeight: 600
                    }}>Source</th>
                            <th style={{
                      textAlign: "left",
                      padding: "10px",
                      fontWeight: 600
                    }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPart.linked_jobs.filter(link => matchesLinkedJobStatus(link.status)).map(link => {
                    const sourceMeta = resolveSourceMeta(link.source);
                    const statusMeta = resolveStatusStyles(link.status);
                    return <tr key={`${link.type}-${link.job_id}-${link.request_id || ""}-${link.status}`} style={{
                      borderBottom: "1px solid var(--surface-light)",
                      transition: "background 0.15s ease"
                    }} onMouseEnter={e => {
                      e.currentTarget.style.background = "var(--surface)";
                    }} onMouseLeave={e => {
                      e.currentTarget.style.background = "transparent";
                    }}>
                                  <td style={{
                        padding: "10px",
                        fontWeight: 600
                      }}>
                                    <a href={`/job-cards/${link.job_number}`} target="_blank" rel="noopener noreferrer" style={{
                          color: "var(--primary)",
                          textDecoration: "none",
                          fontWeight: 700,
                          transition: "color 0.2s ease"
                        }} onMouseEnter={e => {
                          e.currentTarget.style.textDecoration = "underline";
                        }} onMouseLeave={e => {
                          e.currentTarget.style.textDecoration = "none";
                        }}>
                                      {link.job_number}
                                    </a>
                                  </td>
                                  <td style={{
                        padding: "10px",
                        textAlign: "right",
                        fontWeight: 600
                      }}>{link.quantity || 1}</td>
                                  <td style={{
                        padding: "10px"
                      }}>
                                    <RequirementBadge label={sourceMeta.label} background={sourceMeta.background} color={sourceMeta.color} />
                                  </td>
                                  <td style={{
                        padding: "10px"
                      }}>
                                    <RequirementBadge label={formatStatusLabel(link.status)} background={statusMeta.background} color={statusMeta.color} />
                                  </td>
                                </tr>;
                  })}
                        </tbody>
                      </table>
                    </div> : <div style={{
              padding: "24px",
              textAlign: "center",
              color: "var(--text-secondary)",
              background: "var(--surface)",
              borderRadius: "var(--radius-xs)",
              fontSize: "var(--text-body)"
            }}>
                      No linked jobs for this part
                    </div>}
                </div>
              </div>
            </div>
          </div>}

        {renderAddToJobModal()}
        {renderDeliveryModal()}
      </div>
      <ConfirmationDialog isOpen={!!confirmDialog} message={confirmDialog?.message} cancelLabel="Cancel" confirmLabel="Yes" onCancel={() => setConfirmDialog(null)} onConfirm={confirmDialog?.onConfirm} />
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
