const Parser = require('binary-parser').Parser;
const P = () => Parser.start().endianess('little');

Parser.prototype.AcString = function (n) { return this.nest(n, { type: P().uint32('nameLength').string('name', { length: 'nameLength' }), formatter: e => e.name }); };
Parser.prototype.AcVector2 = function (n) { return this.nest(n, { type: P().array('items', { type: 'floatle', length: 2 }), formatter: e => ({ x: e.items[0], y: e.items[1] }) }); };
Parser.prototype.AcVector3 = function (n) { return this.nest(n, { type: P().array('items', { type: 'floatle', length: 3 }), formatter: e => ({ x: e.items[0], y: e.items[1], z: e.items[2] }) }); };
Parser.prototype.AcVector4 = function (n) { return this.nest(n, { type: P().array('items', { type: 'floatle', length: 4 }), formatter: e => ({ x: e.items[0], y: e.items[1], z: e.items[2], w: e.items[3] }) }); };
Parser.prototype.AcMatrix = function (n) { return this.nest(n, { type: P().array('items', { type: 'floatle', length: 16 }), formatter: e => [] }); };

Parser.prototype.AcNode = function (n) {
  return this.nest(n, {
    type: P().namely('self').uint32('nodeClass').AcString('name')
      .choice('data', {
        tag: 'nodeClass', choices: {
          1: P().uint32('childrenCount').uint8('active').AcMatrix('transform').array('children', { type: 'self', length: 'childrenCount' }),
          2: P().uint32('childrenCount').uint8('active').uint8('castShadows').uint8('isVisible').uint8('isTransparent')
            .uint32('verticesSize').array('vertices', {
              type: P().AcVector3('pos').AcVector3('normal').AcVector2('tex').AcVector3('tangent'),
              length: 'verticesSize',
              formatter: e => []
            })
            .uint32('indicesSize').array('indices', {
              type: 'uint16le',
              length: 'indicesSize',
              formatter: e => []
            })
            .uint32('materialID')
            .skip(28)
            .uint8('isRenderable'),
          3: P().uint32('childrenCount').uint8('active').uint8('castShadows').uint8('isVisible').uint8('isTransparent')
            .uint32('bonesSize').array('bones', {
              type: P().AcString('name').AcMatrix('transform'),
              length: 'bonesSize',
              formatter: e => []
            })
            .uint32('verticesSize').array('vertices', {
              type: P().AcVector3('pos').AcVector3('normal').AcVector2('tex').AcVector3('tangent').AcVector4('weights').AcVector4('indices'),
              length: 'verticesSize',
              formatter: e => []
            })
            .uint32('indicesSize').array('indices', {
              type: 'uint16le',
              length: 'indicesSize',
              formatter: e => []
            })
            .uint32('materialID')
            .skip(12)
        }
      })
  });
};

var kn5File = P()
  .skip(6)
  .uint32('version')
  .choice('versionExtra', {
    tag: 'version',
    choices: { 6: P().uint32('extra') },
    defaultChoice: P()
  })
  .uint32('texturesCount')
  .array('textures', {
    type: P().uint32('state').choice('data', { tag: 'state', choices: { 1: P().AcString('name').uint32('size').skip('size') } }),
    length: 'texturesCount',
    formatter: e => e.map(x => ({ active: x.state != 0, name: x.data.name, size: x.data.size }))
  })
  .uint32('materialsCount')
  .array('materials', {
    type: P().AcString('name').AcString('shader').uint8('blend').uint8('alphaTested').uint32('depthMode')
      .uint32('propertiesCount').array('properties', {
        type: P().AcString('name').floatle('v1').AcVector2('v2').AcVector3('v3').AcVector4('v4'),
        length: 'propertiesCount',
        formatter: e => e.map(x => ({ name: x.name, v1: x.v1, v3: x.v3 }))
      })
      .uint32('resourcesCount').array('resources', {
        type: P().AcString('name').uint32('slot').AcString('texture'),
        length: 'resourcesCount'
      }),
    length: 'materialsCount'
  })
  .AcNode('root');

module.exports = data => kn5File.parse(data);