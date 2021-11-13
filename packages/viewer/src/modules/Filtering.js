import * as THREE from 'three'
import Rainbow from 'rainbowvis.js'
import { cloneUniforms } from 'three'

const WireframeMaterial = new THREE.MeshStandardMaterial( {
  color: 0x7080A0,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.04,
  wireframe: true
} )

const ColoredMaterial = new THREE.MeshStandardMaterial( {
  color: 0x7080A0,
  side: THREE.DoubleSide,
  transparent: false
} )


export function filterAndColorObject( obj, filter ) {
    if ( !filter )
      return obj.clone()
    if ( !passesFilter( obj.userData, filter.filterBy ) )
    {
      if ( filter.ghostOthers && obj.type === 'Mesh' ) {
        let clone = obj.clone()
        // clone.material = WireframeMaterial
        clone.material = obj.material.clone()
        clone.material.transparent = true
        clone.material.opacity = 0.05
        clone.userData = null
        return clone
      }
      return null
    }

    let clone = obj.clone()
    if ( filter.colorBy ) {
      if ( filter.colorBy.type === 'category' ) {
        clone.material = colorWithCategory( obj.userData, filter.colorBy )
      } else if ( filter.colorBy.type === 'gradient' ) {
        clone.material = colorWithGradient( obj, filter.colorBy )
      }
    }

    return clone
}

function getObjectProperty( obj, property ) {
  if ( !property ) return
  let keyParts = property.split( '.' )
    let crtObj = obj
    for ( let i = 0; i < keyParts.length - 1; i++ ) {
      if ( !( keyParts[i] in crtObj ) ) return
      crtObj = crtObj[ keyParts[i] ]
      if ( crtObj.constructor !== Object ) return
    }
    let attributeName = keyParts[ keyParts.length - 1 ]
    return crtObj[ attributeName ]
}

function colorWithCategory( obj, colors ) {
  let defaultValue = colors.default
  let color = defaultValue
  let objValue = getObjectProperty( obj, colors.property )
  let customPallete = colors.values || {}
  if ( objValue in customPallete ) {
    color = customPallete[ objValue ]
  }

  if ( !color ) {
    // compute value hash
    let objValueAsString = '' + objValue
    let hash = 0
    for( let i = 0; i < objValueAsString.length; i++ ) {
      let chr = objValueAsString.charCodeAt( i )
      hash = ( ( hash << 5 ) - hash ) + chr
      hash |= 0 // Convert to 32bit integer
    }
    hash = Math.abs( hash )
    let colorHue = hash % 360
    color = `hsl(${colorHue}, 50%, 30%)`
  }

  let material = ColoredMaterial.clone()
  material.color = new THREE.Color( color )
  return material
}

function colorWithGradient( threejsObj, colors ) {
  let obj = threejsObj.userData
  let rainbow = new Rainbow( )
  if ( 'minValue' in colors && 'maxValue' in colors )
    rainbow.setNumberRange( colors.minValue, colors.maxValue )
  if ( 'gradientColors' in colors )
  rainbow.setSpectrum( ...colors.gradientColors )

  let objValue = getObjectProperty( obj, colors.property )
  objValue = Number( objValue )
  if ( Number.isNaN( objValue ) ) {
    return WireframeMaterial
  }
  
  let material = ColoredMaterial.clone()
  material.color = new THREE.Color( `#${rainbow.colourAt( objValue )}` )
  return material
}

function passesFilter( obj, filterBy ) {
  if ( !filterBy ) return true
  for ( let filterKey in filterBy ) {
    let objValue = getObjectProperty( obj, filterKey )

    let passesFilter = filterValue( objValue, filterBy[ filterKey ] )
    if ( !passesFilter ) return false
  }
  return true
}

function filterValue( objValue, valueFilter ) {
  // Array value filter means it can be any value from the array
  if ( Array.isArray( valueFilter ) )
    return valueFilter.includes( objValue )

  // Dictionary value filter can specify ranges with `lte` and `gte` fields (LowerThanOrEqual, GreaterThanOrEqual)
  if ( valueFilter.constructor === Object ) {
    if ( 'not' in valueFilter && Array.isArray( valueFilter.not ) ) {
      if ( valueFilter.not.includes( objValue ) )
        return false
    }
    if ( 'lte' in valueFilter && objValue > valueFilter.lte )
      return false
    if ( 'gte' in valueFilter && objValue < valueFilter.gte )
      return false
    return true
  }

  // Can also filter by specific value
  return objValue === valueFilter
}