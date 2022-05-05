import './h5peditor-info-wall.scss';

import Util from './h5peditor-info-wall-util';

/** Class for InfoWallPropertiesList widget */
export default class InfoWall {

  /**
   * @constructor
   * @param {object} parent Parent element in semantics.
   * @param {object} field Semantics field properties.
   * @param {object} params Parameters entered in editor form.
   * @param {function} setValue Callback to set parameters.
   */
  constructor(parent, field, params, setValue) {
    this.parent = parent;
    this.field = field;
    this.params = params;
    this.setValue = setValue;

    // Callbacks to call when parameters change
    this.changes = [];

    // Let parent handle ready callbacks of children
    this.passReadies = true;

    // DOM
    this.$container = H5P.jQuery('<div>', {
      class: 'h5peditor-info-wall'
    });

    // Instantiate original field (or create your own and call setValue)
    this.fieldInstance = new H5PEditor.widgets[this.field.type](this.parent, this.field, this.params, this.setValue);
    this.fieldInstance.appendTo(this.$container);

    // Errors (or add your own)
    this.$errors = this.$container.find('.h5p-errors');

    this.parent.ready(() => {
      this.initialize();
    });
  }

  /**
   * Initialize.
   */
  initialize() {
    this.propertiesList = this.findField('propertiesGroup/properties', this.fieldInstance);
    this.propertyFields = this.getPropertyFields();

    this.propertiesList.on('addedItem', event => {
      this.handlePropertyAdded(event.data);
    });
    this.propertiesList.on('removedItem', event => {
      this.handlePropertyRemoved(event.data);
    });
    /*
     * Unfortunately, the 1 line of code pull request that would allow to check
     * for changes of the order in 1 line of code is waiting for approval since
     * May 3, 2020 (https://github.com/h5p/h5p-editor-php-library/pull/113).
     * We'll have to do this ugly DOM + order comparison workaround (or replace
     * the widget completely).
     */
    H5P.$window.get(0).addEventListener('mouseup', () => {
      clearTimeout(this.mouseUpTimeout);
      this.mouseUpTimeout = setTimeout(() => {
        const moved = this.updatePropertyOrder();

        if (moved.from !== undefined && moved.to !== undefined) {
          this.updateEntriesOrder(moved);
        }

      }, 100); // H5P list needs to move item
    });

    this.panelsList = this.findField('panels', this.fieldInstance);
    this.panelsList.on('addedItem', event => {
      this.fillUpEntries(event.data);
      this.addPanelTitleListeners(event.data);
    });

    this.panelsList.forEachChild(panel => {
      this.fillUpEntries(panel);
      this.addPanelTitleListeners(panel);
    });

    this.propertiesList.forEachChild(child => {
      const labelField = this.findField('label', child);
      labelField.change(() => this.updateLabels());
    });

    // Initial update
    this.updateLabels();
  }

  /**
   * Add panel listeners to trigger panel title update.
   * @param {H5P.List} panel Panel.
   */
  addPanelTitleListeners(panel) {
    const image = this.findField('image', panel);

    // Wait for metadata form to be appended
    Util.waitForChild(image, 'metadataForm', () => {
      // Listen for metadataform title changes
      image.metadataForm.children
        .filter(child => child?.field?.name === 'title')
        .shift()
        .$input.get(0)
        .addEventListener('change', () => {
          this.setPanelTitle(panel);
        });

      // Listen for alt tag changes
      const altTagField = this.findField('alt', image);
      if (typeof altTagField.change === 'function') {
        altTagField.change(() => this.setPanelTitle(panel));
      }

      // Initial title check
      this.setPanelTitle(panel);
    });

    // Listen for entry changes
    const entries = this.findField('entries', panel);
    entries.forEachChild(entry => {
      entry.$input.on('change', () => {
        this.setPanelTitle(panel);
      });
    });
  }

  /**
   * Set panel title. Hidden field that will be checked by vertical tabs widget.
   * @param {H5P.List} panel Panel.
   */
  setPanelTitle(panel) {
    const titleField = this.findField('panelTitle', panel);
    titleField.$input.val(this.determineBestPanelTitle(panel));
    titleField.$input.change();
  }

  /**
   * Determine best title for panel.
   * @param {object} panel Panel element.
   * @return {string} Best title for panel.
   */
  determineBestPanelTitle(panel) {
    const image = this.findField('image', panel);

    // Preferred title: metadata title of image
    let text = image.metadataForm.children.filter(child => child?.field?.name === 'title').shift().value;
    if (text && text !== H5PEditor.t('core', 'untitled').replace(':libraryTitle', 'Image')) {
      return text;
    }

    // Next best title: alt description of image
    text = image.$libraryWrapper.get(0).querySelector('.field-name-alt input').value;
    if (text && text !== '') {
      return text;
    }

    // Next best title: first filled field
    const entries = this.findField('entries', panel);
    entries.forEachChild(child => {
      if (text) {
        return;
      }
      text = Util.htmlDecode(child.value || '');
    });

    if (text && text !== '') {
      return text;
    }

    // Fallback for untitled panel
    return H5PEditor.t('core', 'untitled')
      .replace(':libraryTitle', H5PEditor.t('H5PEditor.InfoWall', 'panel'));
  }

  /**
   * Fill up entries.
   * @param {H5P.List} panel Panel.
   */
  fillUpEntries(panel) {
    const entries = this.findField('entries', panel);

    // 1 element is set by H5P List, so for new panel, we set 1 not 0
    const entriesPresent = (entries.getValue() || ['']).length;
    for (let i = entriesPresent; i < this.propertyFields.length; i++) {
      entries.addItem();
    }

    this.updateLabels();
  }

  /**
   * Determine whether propertyOrder has changed.
   * @return {object} Info where property was moved from and where to.
   */
  updatePropertyOrder() {
    const currentPropertyFields = this.getPropertyFields();
    const newOrder = currentPropertyFields.map(field => this.propertyFields.indexOf(field));
    this.propertyFields = currentPropertyFields;

    // Will always be one rolling move
    return newOrder.reduce((moved, position, index) => {
      if (position !== index) {
        moved.from = moved.from ?? index;
        moved.to = index;
      }

      if (index === newOrder.length - 1) {
        if (newOrder[moved.from] === moved.to) {
          const tmp = moved.from;
          moved.from = moved.to;
          moved.to = tmp;
        }
      }

      return moved;
    }, {});
  }

  /**
   * Update the order of entries in the list.
   * @param {object} newOrder Info about changed positions.
   * @param {number} newOrder.from Position index of field that was moved.
   * @param {number} newOrder.to Position index that field should go to.
   */
  updateEntriesOrder(newOrder) {
    this.panelsList.forEachChild(child => {
      const entries = this.findField('entries', child);
      entries.moveItem(newOrder.from, newOrder.to);
      entries.widget.updateOrder();
    });
  }

  /**
   * Get propertyFields.
   * @return {H5PEditor.Text[]} Editor fields.
   */
  getPropertyFields() {
    const propertyFields = [];
    this.propertiesList.forEachChild(propertyGroup => {
      propertyFields.push(this.findField('label', propertyGroup));
    });
    return propertyFields;
  }

  /**
   * Handle added property in list.
   * @param {object} property Added property.
   */
  handlePropertyAdded(property) {
    clearTimeout(this.mouseUpTimeout);

    // Trigger update when property label is changed
    const labelField = this.findField('label', property);
    labelField.change(() => this.updateLabels());

    this.panelsList.forEachChild(child => {
      const entries = this.findField('entries', child);
      entries.addItem();
    });

    this.updateLabels();

    this.propertyFields = this.getPropertyFields();
  }

  /**
   * Handle removed property in list.
   * @param {number} index Index of property in list.
   */
  handlePropertyRemoved(index) {
    clearTimeout(this.mouseUpTimeout);

    this.panelsList.forEachChild(child => {
      const entries = this.findField('entries', child);
      entries.removeItem(index);
    });

    this.propertyFields = this.getPropertyFields();
  }

  /**
   * Update labels.
   */
  updateLabels() {
    const labels = [];

    this.propertiesList.forEachChild(child => {
      labels.push(this.findField('label', child).value);
    });

    this.panelsList.forEachChild(child => {
      let index = 0;

      const entries = this.findField('entries', child);
      entries.forEachChild(entry => {
        entry.infoWallLabel = labels[index];
        index++;
      });

      entries.widget.updateLabels();
    });
  }

  /**
   * Append field to wrapper. Invoked by H5P core.
   * @param {H5P.jQuery} $wrapper Wrapper.
   */
  appendTo($wrapper) {
    this.$container.appendTo($wrapper);
  }

  /**
   * Validate current values. Invoked by H5P core.
   * @return {boolean} True, if current value is valid, else false.
   */
  validate() {
    return this.fieldInstance.validate();
  }

  /**
   * Remove self. Invoked by H5P core.
   */
  remove() {
    this.$container.remove();
  }

  /**
   * Find field from path.
   * @param {string} path Path.
   * @param {object} parent Parent field.
   * @returns {object|boolean} Field or false.
   */
  findField(path, parent) {
    if (typeof path === 'string') {
      path = path.split('/');
    }

    if (path[0] === '..') {
      path.splice(0, 1);
      return this.findField(path, parent.parent);
    }

    if (!parent.children) {
      return false;
    }

    for (var i = 0; i < parent.children.length; i++) {
      if (parent.children[i].field.name === path[0]) {
        // Regular Field
        path.splice(0, 1);
        if (path.length) {
          return this.findField(path, parent.children[i]);
        }
        else {
          return parent.children[i];
        }
      }
      else if (typeof parent.children[i].getName === 'function' && parent.children[i].getName() === path[0]) {
        // List, children are instances of same type, diving deeper not possible
        return parent.children[i];
      }
    }

    return false;
  }
}
